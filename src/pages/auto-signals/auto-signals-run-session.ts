import { observer as globalObserver } from '@/external/bot-skeleton';
import type { AutoSignalsRun } from './types';

export interface AutoSignalsRunSession {
    run: AutoSignalsRun | null;
    message: string;
}

let session: AutoSignalsRunSession = { run: null, message: '' };
let stopBot: (() => void) | null = null;
let stopRequested = false;
const contractIds = new Set<string>();
const listeners = new Set<(next: AutoSignalsRunSession) => void>();

const emit = () => {
    listeners.forEach((listener) => listener(session));
};

const isSettledBotContract = (contract: any) => {
    const status = String(contract?.status ?? contract?.contract_status ?? '').toLowerCase();
    return contract?.is_sold === 1
        || contract?.is_sold === true
        || contract?.is_expired === 1
        || contract?.is_expired === true
        || ['won', 'lost', 'sold', 'settled', 'expired'].includes(status);
};

const onBotContract = (contract: any) => {
    const currentRun = session.run;
    if (!currentRun || !isSettledBotContract(contract)) return;
    const symbol = String(contract?.underlying || contract?.underlying_symbol || contract?.symbol || '');
    if (symbol && symbol !== currentRun.symbol) return;
    const contractId = String(
        contract?.contract_id
        ?? contract?.id
        ?? `${contract?.date_start ?? contract?.purchase_time ?? ''}:${contract?.profit ?? ''}:${contract?.status ?? ''}`,
    );
    if (contractIds.has(contractId)) return;
    contractIds.add(contractId);

    const completedRuns = currentRun.completedRuns + 1;
    session = {
        run: { ...currentRun, completedRuns },
        message: completedRuns >= currentRun.maxRuns
            ? `Completed the ${currentRun.maxRuns}-run limit. Bot Builder is stopping this run.`
            : `Bot Builder completed ${completedRuns} of ${currentRun.maxRuns} runs on ${currentRun.symbol}.`,
    };
    emit();

    if (completedRuns >= currentRun.maxRuns && !stopRequested) {
        stopRequested = true;
        window.setTimeout(() => {
            if (session.run?.startedAt === currentRun.startedAt) stopBot?.();
        }, 0);
    }
};

const onBotStop = () => {
    const stopped = session.run;
    if (!stopped) return;
    session = {
        run: null,
        message: stopped.completedRuns >= stopped.maxRuns
            ? `Completed the ${stopped.maxRuns}-run limit on ${stopped.symbol}.`
            : `Bot Builder stopped ${stopped.completedRuns} of ${stopped.maxRuns} runs on ${stopped.symbol}.`,
    };
    stopBot = null;
    stopRequested = false;
    contractIds.clear();
    emit();
};

// Tabs renders only the active child. Keep this observer alive when the
// Auto-Signals page hands a bot to Bot Builder and unmounts.
globalObserver.register('bot.contract', onBotContract);
globalObserver.register('bot.stop', onBotStop);

export const getAutoSignalsRunSession = () => session;

export const subscribeAutoSignalsRunSession = (
    listener: (next: AutoSignalsRunSession) => void,
) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const beginAutoSignalsRun = (
    run: AutoSignalsRun,
    stop: () => void,
    message: string,
) => {
    session = { run, message };
    stopBot = stop;
    stopRequested = false;
    contractIds.clear();
    emit();
};

export const clearAutoSignalsRun = (message: string) => {
    session = { run: null, message };
    stopBot = null;
    stopRequested = false;
    contractIds.clear();
    emit();
};

export const setAutoSignalsRunMessage = (message: string) => {
    session = { ...session, message };
    emit();
};
