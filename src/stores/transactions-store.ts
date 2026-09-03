// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import { action, computed, makeObservable, observable, reaction } from 'mobx';
import { formatDate, isEnded } from '@/components/shared';
import { LogTypes } from '@/external/bot-skeleton';
import { ProposalOpenContract } from '@deriv/api-types';
import { TPortfolioPosition, TStores } from '@deriv/stores/types';
import { TContractInfo } from '../components/summary/summary-card.types';
import { transaction_elements } from '../constants/transactions';
import { getStoredItemsByKey, getStoredItemsByUser, setStoredItemsByKey } from '../utils/session-storage';
import RootStore from './root-store';

type TTransaction = {
    type: string;
    data?: string | TContractInfo;
};

type TElement = {
    [key: string]: TTransaction[];
};

const dedupeStoredElements = (elements: TElement): TElement =>
    Object.fromEntries(Object.entries(elements || {}).map(([accountId, rows]) => {
        const seen = new Set<string>();
        const deduped = rows.filter(row => {
            if (row.type !== transaction_elements.CONTRACT || typeof row.data === 'string') return true;
            const contract = row.data as any;
            const identity = contract?.contract_id != null
                ? `contract:${contract.contract_id}`
                : contract?.transaction_ids?.buy != null
                    ? `buy:${contract.transaction_ids.buy}`
                    : null;
            if (!identity) return true;
            if (seen.has(identity)) return false;
            seen.add(identity);
            return true;
        });
        return [accountId, deduped];
    }));

export default class TransactionsStore {
    root_store: RootStore;
    core: TStores;
    disposeReactionsFn: () => void;

    constructor(root_store: RootStore, core: TStores) {
        this.root_store = root_store;
        this.core = core;
        this.is_transaction_details_modal_open = false;
        this.registerAutoTradeListener();
        this.disposeReactionsFn = this.registerReactions();

        makeObservable(this, {
            elements: observable,
            active_transaction_id: observable,
            recovered_completed_transactions: observable,
            recovered_transactions: observable,
            is_called_proposal_open_contract: observable,
            is_transaction_details_modal_open: observable,
            transactions: computed,
            onBotContractEvent: action.bound,
            pushTransaction: action.bound,
            clear: action.bound,
            registerReactions: action.bound,
            recoverPendingContracts: action.bound,
            updateResultsCompletedContract: action.bound,
            sortOutPositionsBeforeAction: action.bound,
            recoverPendingContractsById: action.bound,
        });
    }
    TRANSACTION_CACHE = 'transaction_cache';

    elements: TElement = dedupeStoredElements(
        getStoredItemsByUser(this.TRANSACTION_CACHE, this.core?.client?.loginid, [])
    );
    active_transaction_id: null | number = null;
    recovered_completed_transactions: number[] = [];
    recovered_transactions: number[] = [];
    is_called_proposal_open_contract = false;
    is_transaction_details_modal_open = false;
    private auto_trade_listener: ((event: Event) => void) | null = null;

    get transactions(): TTransaction[] {
        const accountId = this.core?.client?.loginid || localStorage.getItem('active_loginid');
        if (accountId) return this.elements[accountId] ?? [];
        return [];
    }

    get statistics() {
        let total_runs = 0;
        // Filter out only contract transactions and remove dividers
        const trxs = this.transactions.filter(
            trx =>
                trx.type === transaction_elements.CONTRACT &&
                typeof trx.data === 'object' &&
                !(trx.data as any).is_virtual_hook
        );
        const statistics = trxs.reduce(
            (stats, { data }) => {
                const contract = data as TContractInfo;
                const profit = Number(contract.profit) || 0;
                const is_completed = contract.is_completed || false;
                const buy_price = Number(contract.buy_price) || 0;
                const payout = Number(contract.payout) || Number(contract.bid_price) || 0;
                const bid_price = Number(contract.bid_price) || 0;

                if (is_completed) {
                    if (profit > 0) {
                        stats.won_contracts += 1;
                        stats.total_payout += payout ?? bid_price ?? 0;
                    } else {
                        stats.lost_contracts += 1;
                    }
                    stats.total_profit += profit;
                    stats.total_stake += buy_price;
                    total_runs += 1;
                }
                return stats;
            },
            {
                lost_contracts: 0,
                number_of_runs: 0,
                total_profit: 0,
                total_payout: 0,
                total_stake: 0,
                won_contracts: 0,
            }
        );
        statistics.number_of_runs = total_runs;
        return statistics;
    }

    /**
     * Add a simulated scalper hook to the native Bot Builder transaction feed.
     * It is deliberately marked separately from real contracts so the native
     * summary never includes its stake, wins/losses, payout, or P/L.
     */
    pushVirtualHook(data: {
        id: number;
        time: string;
        market: string;
        result: 'won' | 'lost';
        exitDigit?: number | null;
        hookType?: string;
    }) {
        const current_account = this.core?.client?.loginid as string;
        if (!current_account) return;

        const hookResult = data.result === 'won' ? 'profit' : 'loss';
        const contract: any = {
            is_virtual_hook: true,
            hook_result: hookResult,
            hook_type: data.hookType || 'Virtual Hook',
            contract_id: -Math.abs(data.id),
            transaction_ids: { buy: -Math.abs(data.id), sell: -Math.abs(data.id) },
            date_start: data.time,
            display_name: data.market,
            underlying_symbol: data.market,
            contract_type: 'VIRTUAL_HOOK',
            currency: 'USD',
            entry_spot: '',
            exit_spot: data.exitDigit == null ? '' : String(data.exitDigit),
            buy_price: 0,
            payout: 0,
            bid_price: 0,
            profit: 0,
            is_completed: true,
            run_id: `virtual-hook-${data.id}`,
        };

        if (!this.elements[current_account]) {
            this.elements = { ...this.elements, [current_account]: [] };
        }
        this.elements[current_account] = [
            { type: transaction_elements.CONTRACT, data: contract },
            ...this.elements[current_account],
        ].slice(0, 5000);
        this.elements = { ...this.elements };
    }

    toggleTransactionDetailsModal = (is_open: boolean) => {
        this.is_transaction_details_modal_open = is_open;
    };

    onBotContractEvent(data: TContractInfo) {
        this.pushTransaction(data);
    }

    /**
     * Keep non-Bot-Builder trade events connected for the lifetime of the root
     * store. The Run Panel can mount and unmount independently, so this must
     * not be part of its disposable reaction bundle.
     */
    private registerAutoTradeListener() {
        if (typeof window === 'undefined' || this.auto_trade_listener) return;

        this.auto_trade_listener = (event: Event) => {
            const contract = (event as CustomEvent).detail;
            if (contract?.contract_id) this.onBotContractEvent(contract);
        };
        window.addEventListener('auto-trade:contract', this.auto_trade_listener);
    }

    pushTransaction(data: TContractInfo) {
        // isEnded covers native DBot payloads. The shared authenticated trader
        // also marks its definitive POC update explicitly, so accept those
        // flags/statuses as completed as well instead of leaving a settled
        // Auto Trades/Auto-Digits row open when the payload shape differs.
        const is_completed = Boolean(
            (data as any).is_completed ||
            (data as any).is_sold ||
            ['won', 'lost', 'sold'].includes(String((data as any).status || '').toLowerCase()) ||
            isEnded(data as ProposalOpenContract)
        );
        // Auto Trades supplies a batch ID so its contracts are grouped in the
        // native Bot Builder transaction page. Regular Bot Builder contracts
        // continue using the current run-panel run ID.
        const run_id = (data as any).batch_id || this.root_store.run_panel.run_id;
        const current_account = (this.core?.client?.loginid || localStorage.getItem('active_loginid')) as string;
        if (!current_account || !data?.contract_id) return;

        const contract: TContractInfo = {
            ...data,
            is_completed,
            run_id,
            date_start: formatDate(data.date_start, 'YYYY-M-D HH:mm:ss [GMT]'),
            entry_tick: data.entry_spot,
            entry_tick_time: data.entry_tick_time && formatDate(data.entry_tick_time, 'YYYY-M-D HH:mm:ss [GMT]'),
            exit_tick: (data as any).exit_spot || data.exit_tick,
            exit_tick_time: data.exit_tick_time && formatDate(data.exit_tick_time, 'YYYY-M-D HH:mm:ss [GMT]'),
            profit: is_completed ? data.profit : 0,
        };

        if (!this.elements[current_account]) {
            this.elements = {
                ...this.elements,
                [current_account]: [],
            };
        }

        const same_contract_index = this.elements[current_account]?.findIndex(c => {
            if (typeof c.data === 'string') return false;
            if (c.type !== transaction_elements.CONTRACT) return false;
            const existing = c.data as any;
            const incoming = data as any;
            // The same purchase reaches this store through both the native
            // bot.contract observer and Auto Trades' browser event. Contract
            // IDs are the canonical identity; the buy transaction id is only a
            // fallback for older recovered payloads.
            if (existing?.contract_id && incoming?.contract_id) {
                return Number(existing.contract_id) === Number(incoming.contract_id);
            }
            const existingBuy = existing?.transaction_ids?.buy;
            const incomingBuy = incoming?.transaction_ids?.buy;
            return existingBuy != null && incomingBuy != null && existingBuy === incomingBuy;
        });

        if (same_contract_index === -1) {
            // Render a divider if the "run_id" for this contract is different.
            if (this.elements[current_account]?.length > 0) {
                const temp_contract = this.elements[current_account]?.[0];
                const is_contract = temp_contract.type === transaction_elements.CONTRACT;
                const is_new_run =
                    is_contract &&
                    typeof temp_contract.data === 'object' &&
                    contract.run_id !== temp_contract?.data?.run_id;

                if (is_new_run) {
                    this.elements[current_account]?.unshift({
                        type: transaction_elements.DIVIDER,
                        data: contract.run_id,
                    });
                }
            }

            this.elements[current_account]?.unshift({
                type: transaction_elements.CONTRACT,
                data: contract,
            });
        } else {
            // If data belongs to existing contract in memory, update it.
            this.elements[current_account]?.splice(same_contract_index, 1, {
                type: transaction_elements.CONTRACT,
                data: contract,
            });
        }

        this.elements = { ...this.elements }; // force update
    }

    clear() {
        if (this.elements && this.elements[this.core?.client?.loginid as string]?.length > 0) {
            this.elements[this.core?.client?.loginid as string] = [];
        }
        this.recovered_completed_transactions = this.recovered_completed_transactions?.slice(0, 0);
        this.recovered_transactions = this.recovered_transactions?.slice(0, 0);
        this.is_transaction_details_modal_open = false;
    }

    registerReactions() {
        const { client } = this.core;

        // Write transactions to session storage on each change in transaction elements.
        const disposeTransactionElementsListener = reaction(
            () => this.elements[client?.loginid as string],
            elements => {
                const stored_transactions = getStoredItemsByKey(this.TRANSACTION_CACHE, {});
                stored_transactions[client.loginid as string] = elements?.slice(0, 5000) ?? [];
                setStoredItemsByKey(this.TRANSACTION_CACHE, stored_transactions);
            }
        );

        // User could've left the page mid-contract. On initial load, try
        // to recover any pending contracts so we can reflect accurate stats
        // and transactions.
        const disposeRecoverContracts = reaction(
            () => this.transactions.length,
            () => this.recoverPendingContracts()
        );

        return () => {
            disposeTransactionElementsListener();
            disposeRecoverContracts();
        };
    }

    recoverPendingContracts(contract = null) {
        this.transactions.forEach(({ data: trx }) => {
            if (
                typeof trx === 'string' ||
                trx?.is_completed ||
                !trx?.contract_id ||
                this.recovered_transactions.includes(trx?.contract_id)
            )
                return;
            this.recoverPendingContractsById(trx.contract_id, contract);
        });
    }

    updateResultsCompletedContract(contract: ProposalOpenContract) {
        const { journal, summary_card } = this.root_store;
        const { contract_info } = summary_card;
        const { currency, profit } = contract;

        if (contract.contract_id !== contract_info?.contract_id) {
            this.onBotContractEvent(contract);

            if (contract.contract_id && !this.recovered_transactions.includes(contract.contract_id)) {
                this.recovered_transactions.push(contract.contract_id);
            }
            if (
                contract.contract_id &&
                !this.recovered_completed_transactions.includes(contract.contract_id) &&
                isEnded(contract)
            ) {
                this.recovered_completed_transactions.push(contract.contract_id);

                journal.onLogSuccess({
                    log_type: profit && profit > 0 ? LogTypes.PROFIT : LogTypes.LOST,
                    extra: { currency, profit },
                });
            }
        }
    }

    sortOutPositionsBeforeAction(positions: TPortfolioPosition[], element_id?: number) {
        positions?.forEach(position => {
            if (!element_id || (element_id && position.id === element_id)) {
                const contract_details = position.contract_info;
                this.updateResultsCompletedContract(contract_details);
            }
        });
    }

    async recoverPendingContractsById(contract_id: number, contract: ProposalOpenContract | null = null) {
        // TODO: need to fix as the portfolio is not available now
        // const positions = this.core.portfolio.positions;
        const positions: unknown[] = [];

        if (contract) {
            this.is_called_proposal_open_contract = true;
            if (contract.contract_id === contract_id) {
                this.updateResultsCompletedContract(contract);
            }
        }

        if (!this.is_called_proposal_open_contract) {
            if (this.core?.client?.loginid) {
                const current_account = this.core?.client?.loginid;
                if (!this.elements[current_account]?.length) {
                    this.sortOutPositionsBeforeAction(positions);
                }

                const elements = this.elements[current_account];
                const [element = null] = elements;
                if (typeof element?.data === 'object' && !element?.data?.profit) {
                    const element_id = element.data.contract_id;
                    this.sortOutPositionsBeforeAction(positions, element_id);
                }
            }
        }
    }
}
