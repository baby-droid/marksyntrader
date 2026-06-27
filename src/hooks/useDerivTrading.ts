// @ts-nocheck
import { useState, useRef, useCallback, useEffect } from 'react';
import { api_base } from '@/external/bot-skeleton';

export interface TradeResult {
  id: string;
  type: string;
  stake: number;
  profit: number;
  won: boolean;
  time: number;
  entry_spot?: number;
  exit_spot?: number;
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
      if (balanceSubRef.current) {
        try { balanceSubRef.current.unsubscribe(); } catch (_) {}
      }
      const obs = api_base.api.subscribe({ balance: 1, account: 'current' });
      balanceSubRef.current = obs.subscribe({
        next: (res: any) => {
          if (res?.balance?.balance != null) {
            setBalance(parseFloat(res.balance.balance));
            setCurrency(res.balance.currency || 'USD');
          }
        },
        error: () => {},
      });
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
      // Get proposal
      const proposalReq: any = {
        proposal: 1,
        amount: stake,
        basis: 'stake',
        contract_type,
        currency: cur,
        duration,
        duration_unit,
        symbol,
      };
      if (barrier !== undefined) proposalReq.barrier = String(barrier);

      const proposalRes = await api_base.api.send(proposalReq);
      if (!proposalRes?.proposal?.id) {
        console.error('No proposal id', proposalRes);
        return null;
      }

      // Immediately buy
      const buyRes = await api_base.api.send({
        buy: proposalRes.proposal.id,
        price: proposalRes.proposal.ask_price,
      });

      if (!buyRes?.buy?.contract_id) {
        console.error('Buy failed', buyRes);
        return null;
      }

      const contractId = String(buyRes.buy.contract_id);
      activeContracts.current.add(contractId);

      // Monitor contract to get result
      monitorContract(contractId, contract_type, stake);

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
  }, [currency]);

  const monitorContract = useCallback((contractId: string, type: string, stake: number) => {
    let obs: any;
    try {
      obs = api_base.api.subscribe({ proposal_open_contract: 1, contract_id: parseInt(contractId, 10) });
      const sub = obs.subscribe({
        next: (res: any) => {
          const poc = res?.proposal_open_contract;
          if (!poc) return;
          if (poc.is_sold || poc.status === 'won' || poc.status === 'lost') {
            const profit = parseFloat(poc.profit || '0');
            const won = poc.status === 'won' || profit > 0;
            const result: TradeResult = {
              id: contractId,
              type,
              stake,
              profit,
              won,
              time: Date.now(),
              entry_spot: poc.entry_spot,
              exit_spot: poc.exit_spot,
            };
            setTradeResults(prev => [result, ...prev].slice(0, 200));
            setTotalProfit(prev => prev + profit);
            if (won) setWinCount(prev => prev + 1);
            else setLossCount(prev => prev + 1);
            setBalance(prev => prev !== null ? prev + profit : null);
            activeContracts.current.delete(contractId);
            try { sub.unsubscribe(); } catch (_) {}
          }
        },
        error: () => {},
      });
    } catch (e) {
      console.error('monitorContract error', e);
    }
  }, []);

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
    buyBothDirections,
    clearResults,
    subscribeBalance,
  };
}
