export const DIGIT_MATCH_RESCAN_INTERVAL_MS = 60_000;

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
