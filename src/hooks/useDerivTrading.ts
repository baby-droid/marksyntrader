// @ts-nocheck
import { useState, useRef, useCallback, useEffect } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { applyCommission } from '@/utils/commission';
import { publishMasterTrade, getMasterSource, createTradeKey } from '@/utils/trade-bus';

export interface TradeResult {
  id: string;
  contract_id?: string;
  type: string;
  stake: number;
  profit: number;
  won: boolean;
  time: number;
  entry_spot?: number;
  exit_spot?: number;
  batchId?: string;
  batchIndex?: number;
  batchTotal?: number;
  transaction_id?: string;
}

export interface BatchParams {
  symbol: string;
  contract_type: string;
  stake: number;
  duration: number;
  duration_unit?: string;
  barrier?: string | number;
  currency?: string;
  count: number;
}

export interface BatchEvent {
  phase: 'created' | 'bought' | 'settled' | 'failed';
  batchId: string;
  index?: number;
  total: number;
  contract?: any;
  result?: TradeResult;
  error?: string;
}

export interface UseDerivTradingReturn {
  balance: number | null;
  currency: string;
  isTrading: boolean;
  tradeResults: TradeResult[];
  totalProfit: number;
  winCount: number;
  lossCount: number;
  buyContract: (params: BuyParams) => Promise<TradeResult | null>;
  buyBatch: (params: BatchParams, onEvent?: (event: BatchEvent) => void) => Promise<BatchEvent[]>;
  buyBothDirections: (params: BuyParams) => Promise<void>;
  clearResults: () => void;
  subscribeBalance: () => void;
}

export interface BuyParams {
  symbol: string;
  contract_type: string;
  stake: number;
  duration: number;
  duration_unit?: string;
  barrier?: string | number;
  currency?: string;
}

export function useDerivTrading(): UseDerivTradingReturn {
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [isTrading, setIsTrading] = useState(false);
  const [tradeResults, setTradeResults] = useState<TradeResult[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [winCount, setWinCount] = useState(0);
  const [lossCount, setLossCount] = useState(0);
  const balanceSubRef = useRef<any>(null);
  const activeContracts = useRef<Set<string>>(new Set());

  const subscribeBalance = useCallback(async () => {
    try {
      // APIBase owns the authenticated balance stream. This hook only asks
      // for a snapshot, preventing AlreadySubscribed when multiple pages use
      // useDerivTrading at the same time.
      const res = await api_base.api.send({ balance: 1 });
      if (res?.balance?.balance != null) {
        setBalance(parseFloat(res.balance.balance));
        setCurrency(res.balance.currency || 'USD');
      }
    } catch (e) {
      // Try one-shot balance call
      try {
        const res = await api_base.api.send({ balance: 1 });
        if (res?.balance?.balance != null) {
          setBalance(parseFloat(res.balance.balance));
          setCurrency(res.balance.currency || 'USD');
        }
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    const messageSub = api_base.api?.onMessage()?.subscribe(({ data }: any) => {
      if (data?.balance?.balance != null) {
        setBalance(parseFloat(data.balance.balance));
        setCurrency(data.balance.currency || 'USD');
      }
    });
    balanceSubRef.current = messageSub;
    subscribeBalance();
    return () => {
      if (balanceSubRef.current) {
        try { balanceSubRef.current.unsubscribe(); } catch (_) {}
      }
    };
  }, [subscribeBalance]);

  const buyContract = useCallback(async (params: BuyParams): Promise<TradeResult | null> => {
    const { symbol, contract_type, stake, duration, duration_unit = 't', barrier, currency: cur = currency } = params;
    try {
      setIsTrading(true);
      // Step 1: proposal → get ask_price and proposal ID
      // NOTE: Deriv API requires underlying_symbol (not symbol) in proposal requests.
      // Direct buy with inline parameters causes "Input validation failed" for digit types.
      const proposalReq: any = {
        proposal: 1,
        amount: stake,
        basis: 'stake',
        contract_type,
        currency: cur,
        duration,
        duration_unit,
        underlying_symbol: symbol,
      };
      if (barrier !== undefined) proposalReq.barrier = String(barrier);
      const proposalRes = await api_base.api.send(proposalReq);
      if (proposalRes?.error) throw proposalRes.error;
      const proposalId = proposalRes?.proposal?.id;
      const askPrice = Number(proposalRes?.proposal?.ask_price ?? stake);
      if (!proposalId) throw new Error('Proposal failed — no ID returned');
      const tradeKey = createTradeKey('ui');

      // ── Publish copy-trade signal IN PARALLEL with master's buy ──────
      // Signal fires here (after proposal accepted, before buy confirmed) so
      // follower buys are in-flight simultaneously with the master's buy.
      // Engine deduplicates via 5-second fingerprint window.
      try {
        publishMasterTrade({
          symbol,
          contract_type,
          stake,
          duration,
          duration_unit,
          barrier,
          source: getMasterSource(),
          time:   Date.now(),
           trade_key: tradeKey,
        });
      } catch { /* never let copy-trade errors affect the master trade */ }

      // Step 2: buy using proposal ID
      const buyRes = await api_base.api.send({ buy: proposalId, price: askPrice });

      if (!buyRes?.buy?.contract_id) {
        throw new Error('Buy failed — no contract ID returned');
      }

      const contractId = String(buyRes.buy.contract_id);
      try {
        publishMasterTrade({
          symbol,
          contract_type,
          stake,
          duration,
          duration_unit,
          barrier,
          source: getMasterSource(),
          time: Date.now(),
          contract_id: Number(contractId),
          trade_key: tradeKey,
        });
      } catch { /* never let copy-trade errors affect the master trade */ }
      activeContracts.current.add(contractId);

      // Monitor contract to get result (non-blocking)
      monitorContract(contractId, contract_type, stake);

      // Immediately refresh balance
      subscribeBalance();

      return {
        id: contractId,
        type: contract_type,
        stake,
        profit: 0,
        won: false,
        time: Date.now(),
      };
    } catch (e) {
      console.error('buyContract error', e);
      return null;
    } finally {
      setIsTrading(false);
    }
  }, [currency, subscribeBalance]);

  const monitorContract = useCallback((
    contractId: string,
    type: string,
    stake: number,
    batchMeta: {
      batchId?: string;
      batchIndex?: number;
      batchTotal?: number;
      buyTransactionId?: string;
    } = {},
    onEvent?: (event: BatchEvent) => void
  ) => {
    let obs: any;
    let hasSettled = false;
    try {
      obs = api_base.api.subscribe({ proposal_open_contract: 1, contract_id: parseInt(contractId, 10) });
      const sub = obs.subscribe({
        next: (res: any) => {
          const poc = res?.proposal_open_contract;
          if (!poc) return;
          if (!hasSettled && (poc.is_sold || poc.status === 'won' || poc.status === 'lost')) {
            hasSettled = true;
            const rawProfit = parseFloat(poc.profit || '0');
            const profit = applyCommission(rawProfit);
            const won = poc.status === 'won' || profit > 0;
            const result: TradeResult = {
              id: contractId,
              contract_id: contractId,
              type,
              stake,
              profit,
              won,
              time: Date.now(),
              entry_spot: poc.entry_spot,
              exit_spot: poc.exit_spot,
              transaction_id: poc.transaction_ids?.buy || batchMeta.buyTransactionId,
              ...batchMeta,
            };
            setTradeResults(prev => [result, ...prev].slice(0, 200));
            setTotalProfit(prev => prev + profit);
            if (won) setWinCount(prev => prev + 1);
            else setLossCount(prev => prev + 1);
            setBalance(prev => prev !== null ? prev + profit : null);
            activeContracts.current.delete(contractId);
            if (onEvent && batchMeta.batchId) {
              onEvent({
                phase: 'settled',
                batchId: batchMeta.batchId,
                index: batchMeta.batchIndex,
                total: batchMeta.batchTotal || 1,
                contract: poc,
                result,
              });
            }
            try { sub.unsubscribe(); } catch (_) {}
          }
        },
        error: (error: any) => {
          if (!hasSettled && onEvent && batchMeta.batchId) {
            onEvent({
              phase: 'failed',
              batchId: batchMeta.batchId,
              index: batchMeta.batchIndex,
              total: batchMeta.batchTotal || 1,
              error: error?.message || 'Contract monitoring failed',
            });
          }
        },
      });
    } catch (e) {
      console.error('monitorContract error', e);
    }
  }, []);

  /**
   * Execute a fixed batch through exactly one purchase path:
   * create one proposal per contract concurrently, buy every valid proposal
   * concurrently, then monitor each returned contract independently.
   *
   * The API can still assign slightly different execution spots; concurrency
   * minimizes client-side skew without claiming identical execution.
   */
  const buyBatch = useCallback(async (params: BatchParams, onEvent?: (event: BatchEvent) => void) => {
    const {
      symbol, contract_type, stake, duration, duration_unit = 't',
      barrier, currency: cur = currency, count,
    } = params;
    const total = Math.max(1, Math.min(100, Math.floor(count)));
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const events: BatchEvent[] = [];
    const emit = (event: BatchEvent) => {
      events.push(event);
      onEvent?.(event);
    };

    setIsTrading(true);
    emit({ phase: 'created', batchId, total });
    try {
      const proposalReq: any = {
        proposal: 1,
        amount: stake,
        basis: 'stake',
        contract_type,
        currency: cur,
        duration,
        duration_unit,
        underlying_symbol: symbol,
      };
      if (barrier !== undefined) proposalReq.barrier = String(barrier);

      const proposalResults = await Promise.all(
        Array.from({ length: total }, (_, index) =>
          Promise.resolve()
            .then(() => api_base.api.send({ ...proposalReq }))
            .then((response: any) => ({ status: 'fulfilled', response, index }))
            .catch((error: any) => ({ status: 'rejected', error, index }))
        )
      );
      const proposals = proposalResults
        .filter(({ status, response }: any) => status === 'fulfilled' && response?.proposal?.id && !response?.error)
        .map(({ response, index }: any) => ({ response, index }));

      proposalResults.forEach(({ status, response, error, index }: any) => {
        if (status === 'rejected' || response?.error || !response?.proposal?.id) {
          emit({
            phase: 'failed',
            batchId,
            index,
            total,
            error: error?.message || response?.error?.message || 'Proposal failed',
          });
        }
      });

      if (!proposals.length) return events;

      // Give every batch contract its own identity. A fingerprint-only
      // dedupe would incorrectly collapse identical same-tick contracts.
      const tradeKeys = new Map<number, string>();
      proposals.forEach(({ index }) => {
        const tradeKey = createTradeKey(`batch-${batchId}-${index}`);
        tradeKeys.set(index, tradeKey);
        try {
          publishMasterTrade({
            symbol,
            contract_type,
            stake,
            duration,
            duration_unit,
            barrier,
            source: getMasterSource(),
            time: Date.now(),
            trade_key: tradeKey,
          });
        } catch { /* never let copy-trade errors affect the master batch */ }
      });

      // No buyContract calls here: these are the only buy requests in the batch.
      const buyResults = await Promise.all(
        proposals.map(({ response, index }) =>
          Promise.resolve()
            .then(() => api_base.api.send({
              buy: response.proposal.id,
              price: Number(response.proposal.ask_price ?? stake),
            }))
            .then((buyResponse: any) => ({ status: 'fulfilled', buyResponse, index }))
            .catch((error: any) => ({ status: 'rejected', error, index }))
        )
      );

      buyResults.forEach(({ status, buyResponse, error, index }: any) => {
        const buy = buyResponse?.buy;
        if (status === 'rejected' || !buy?.contract_id) {
          emit({
            phase: 'failed',
            batchId,
            index,
            total,
            error: error?.message || buyResponse?.error?.message || 'Buy returned no contract ID',
          });
          return;
        }

        const contractId = String(buy.contract_id);
        const tradeKey = tradeKeys.get(index);
        try {
          publishMasterTrade({
            symbol,
            contract_type,
            stake: Number(buy.buy_price ?? stake),
            duration,
            duration_unit,
            barrier,
            source: getMasterSource(),
            time: Date.now(),
            contract_id: Number(contractId),
            trade_key: tradeKey,
          });
        } catch { /* never let copy-trade errors affect the master batch */ }
        activeContracts.current.add(contractId);
        const boughtResult: TradeResult = {
          id: contractId,
          contract_id: contractId,
          type: contract_type,
          stake: Number(buy.buy_price ?? stake),
          profit: 0,
          won: false,
          time: Date.now(),
          batchId,
          batchIndex: index,
          batchTotal: total,
          transaction_id: String(buy.transaction_id || buyResponse?.transaction_id || `${batchId}-${index}`),
        };
        emit({ phase: 'bought', batchId, index, total, contract: buy, result: boughtResult });
        monitorContract(contractId, contract_type, Number(buy.buy_price ?? stake), {
          batchId,
          batchIndex: index,
          batchTotal: total,
          buyTransactionId: boughtResult.transaction_id,
        }, emit);
      });

      subscribeBalance();
      return events;
    } catch (error: any) {
      emit({ phase: 'failed', batchId, total, error: error?.message || 'Batch execution failed' });
      return events;
    } finally {
      setIsTrading(false);
    }
  }, [currency, monitorContract, subscribeBalance]);

  const buyBothDirections = useCallback(async (params: BuyParams) => {
    // Hedge: buy CALL and PUT simultaneously at same tick
    await Promise.all([
      buyContract({ ...params, contract_type: 'CALL' }),
      buyContract({ ...params, contract_type: 'PUT' }),
    ]);
  }, [buyContract]);

  const clearResults = useCallback(() => {
    setTradeResults([]);
    setTotalProfit(0);
    setWinCount(0);
    setLossCount(0);
  }, []);

  return {
    balance,
    currency,
    isTrading,
    tradeResults,
    totalProfit,
    winCount,
    lossCount,
    buyContract,
    buyBatch,
    buyBothDirections,
    clearResults,
    subscribeBalance,
  };
}
