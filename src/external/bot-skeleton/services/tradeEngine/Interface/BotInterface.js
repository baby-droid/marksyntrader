import { observer as globalObserver } from '../../../utils/observer';
import { createDetails } from '../utils/helpers';
import { dispatchBrowserEvent } from '../../../utils/browser-event';
import {
    createChartAiPhaseState,
    evaluateChartAiPhaseGate,
} from '@/utils/chart-ai-phase-gate';
import { advanceKingFisherRecoveryEscalation } from '@/utils/king-fisher-recovery-escalation';

const getBotInterface = tradeEngine => {
    const getDetail = i => createDetails(tradeEngine.data.contract)[i];
    const kingFisherAiStates = new Map();

    return {
        init: (...args) => {
            kingFisherAiStates.clear();
            return tradeEngine.init(...args);
        },
        start: (...args) => tradeEngine.start(...args),
        rotateContinuousMarket: async () => {
            const nextSymbol = await tradeEngine.rotateContinuousMarket();
            if (nextSymbol) {
                dispatchBrowserEvent('journal:signal', {
                    type: 'SCAN',
                    label: 'MARKET ROTATED',
                    detail: `Now trading ${nextSymbol}`,
                });
            }
            return nextSymbol;
        },
        stop: (...args) => tradeEngine.stop(...args),
        purchase: contract_type => tradeEngine.purchase(contract_type),
        purchaseMultiple: contract_types => tradeEngine.purchaseMultiple(contract_types),
        getAskPrice: contract_type => Number(getProposal(contract_type, tradeEngine).ask_price),
        getPayout: contract_type => Number(getProposal(contract_type, tradeEngine).payout),
        getPurchaseReference: () => tradeEngine.getPurchaseReference(),
        isSellAvailable: () => tradeEngine.isSellAtMarketAvailable(),
        sellAtMarket: () => tradeEngine.sellAtMarket(),
        getSellPrice: () => getSellPrice(tradeEngine),
        isResult: result => getDetail(10) === result,
        isTradeAgain: result => globalObserver.emit('bot.trade_again', result),
        recordVirtualHook: data => {
            globalObserver.emit('bot.virtual_hook', data);
            const hookResult = data?.result === 'won' ? 'profit' : 'loss';
            const market = data?.market || 'King Fisher';
            const digitDetail = data?.exitDigit == null ? '' : ` · digit ${data.exitDigit}`;
            dispatchBrowserEvent('journal:signal', {
                type: hookResult === 'profit' ? 'WIN' : 'LOSS',
                label: hookResult === 'profit' ? 'HOOK PROFIT' : 'HOOK LOSS',
                detail: `${market} · virtual ${hookResult}${digitDetail}`,
            });
        },
        emitJournalSignal: detail => dispatchBrowserEvent('journal:signal', detail),
        emitKingFisherAnalysis: detail => dispatchBrowserEvent('bot:king-fisher-analysis', detail),
        emitMarketDigit: detail => dispatchBrowserEvent('bot:market-digit', detail),
        evaluateKingFisherChartAiPhaseGate: (key, direction, barrier, epoch, digit) => {
            const symbol = tradeEngine.tradeOptions?.symbol || tradeEngine.options?.symbol || '';
            const state = kingFisherAiStates.get(key) || createChartAiPhaseState();
            kingFisherAiStates.set(key, state);
            const result = evaluateChartAiPhaseGate(
                state,
                direction === 'LOW' ? 'LOW' : 'HIGH',
                Number(barrier),
                Number(epoch),
                Number(digit),
                symbol,
            );
            if (result.updated) {
                dispatchBrowserEvent('bot:king-fisher-analysis', {
                    symbol,
                    direction,
                    barrier: Number(barrier),
                    windows: result.windows,
                    strategyVotes: result.strategyVotes,
                    votes: result.votes,
                    passed: result.passed,
                });
            }
            return result.passed;
        },
        advanceKingFisherRecoveryEscalation: (...args) =>
            advanceKingFisherRecoveryEscalation(...args),
        requestKingFisherRescan: detail => {
            tradeEngine.kingFisherRescanRequested = detail || { reason: 'risk-limit' };
        },
        shouldRescanKingFisher: () => Boolean(tradeEngine.kingFisherRescanRequested),
        getSymbol: () => tradeEngine.tradeOptions?.symbol || tradeEngine.options?.symbol || '',
        readDetails: i => getDetail(i - 1),
    };
};

const getProposal = (contract_type, tradeEngine) => {
    return tradeEngine.data.proposals.find(
        proposal =>
            proposal.contract_type === contract_type &&
            proposal.purchase_reference === tradeEngine.getPurchaseReference()
    );
};

const getSellPrice = tradeEngine => {
    return tradeEngine.getSellPrice();
};

export default getBotInterface;
