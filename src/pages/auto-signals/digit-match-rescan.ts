export const DIGIT_MATCH_RESCAN_INTERVAL_MS = 60_000;

export const isDigitMatchRescanDue = (
    now: number,
    lastRescanAt: number,
    force = false,
) => force || now - lastRescanAt >= DIGIT_MATCH_RESCAN_INTERVAL_MS;

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
