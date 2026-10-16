import type { AutoSignalCandidate } from './types';

export const DIGIT_MATCH_RESCAN_INTERVAL_MS = 60_000;

export const isDigitMatchRescanDue = (
    now: number,
    lastRescanAt: number,
    force = false,
) => force || now - lastRescanAt >= DIGIT_MATCH_RESCAN_INTERVAL_MS;

/**
 * The statistical match prediction is rescored on a slower cadence, but its
 * entry digit is a live condition and must follow every incoming tick.
 */
export const refreshMatchEntryReadiness = (
    candidates: AutoSignalCandidate[],
    latestDigit: number | null,
    now: number,
): AutoSignalCandidate[] => {
    if (latestDigit == null || !Number.isInteger(latestDigit) || latestDigit < 0 || latestDigit > 9) {
        return candidates;
    }

    return candidates.map((candidate) => {
        if (candidate.strategy !== 'MATCHES' || candidate.entryDigit == null) return candidate;

        const entryReady = latestDigit === candidate.entryDigit;
        const relevantWindows = candidate.windows.filter(
            (window) => window.window >= 50 && window.sampleSize >= 5,
        );
        const agreements = relevantWindows.filter((window) => window.agrees).length;
        const state = candidate.score >= 70 && entryReady && agreements >= 2
            ? 'ready'
            : candidate.score >= 58
                ? 'setup'
                : 'watch';

        if (candidate.entryReady === entryReady && candidate.state === state) return candidate;
        return { ...candidate, entryReady, state, updatedAt: now };
    });
};

type IntervalHost = Pick<typeof window, 'setInterval' | 'clearInterval'>;

export const startDigitMatchMarketRescan = (
    enabled: boolean,
    rescan: () => void,
    intervalHost: IntervalHost = window,
) => {
    if (!enabled) return () => undefined;

    rescan();
    const timer = intervalHost.setInterval(rescan, DIGIT_MATCH_RESCAN_INTERVAL_MS);
    return () => intervalHost.clearInterval(timer);
};
