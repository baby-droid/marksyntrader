export type AutoSignalFamily =
    | 'AUTO'
    | 'PARITY'
    | 'OVER_UNDER'
    | 'RISE_FALL'
    | 'ONLY_UP_DOWN'
    | 'DIFFERS'
    | 'MATCHES';

export type AutoSignalAction = 'trade-only' | 'entry-trade';

export type AutoSignalTier = 'NO SIGNAL' | 'WATCH' | 'SETUP' | 'STRONG' | 'ELITE';

export type AutoSignalState =
    | 'warming'
    | 'unavailable'
    | 'no-signal'
    | 'watch'
    | 'setup'
    | 'ready'
    | 'expired';

export type AutoSignalStrategy =
    | 'EVEN'
    | 'ODD'
    | 'OVER'
    | 'UNDER'
    | 'RISE'
    | 'FALL'
    | 'ONLY_UPS'
    | 'ONLY_DOWNS'
    | 'DIFFERS'
    | 'MATCHES';

export type AutoSignalWindowSize = 1000 | 100 | 50 | 20 | 10;

export interface AutoSignalWindowResult {
    window: AutoSignalWindowSize;
    sampleSize: number;
    probability: number;
    agrees: boolean;
}

export interface AutoSignalCandidate {
    id: string;
    strategy: AutoSignalStrategy;
    label: string;
    contractType: string;
    barrier: number | null;
    direction: 'even' | 'odd' | 'over' | 'under' | 'rise' | 'fall' | 'up' | 'down' | 'matches' | 'differs';
    score: number;
    tier: AutoSignalTier;
    state: AutoSignalState;
    reason: string;
    windows: AutoSignalWindowResult[];
    entryDigit: number | null;
    entryReady: boolean;
    createdAt: number | null;
    expiresAt: number | null;
    updatedAt: number;
    recommendedRuns: number;
}

export interface AutoSignalMarket {
    symbol: string;
    label: string;
    market: string;
    submarket: string;
    tickCount: number;
    latestDigit: number | null;
    latestQuote: number | null;
    updatedAt: number | null;
    feedState: 'loading' | 'live' | 'stale' | 'error' | 'unavailable';
    candidate: AutoSignalCandidate | null;
    availableContractTypes: string[];
    error?: string;
}

export interface AutoSignalsSettings {
    maxRuns: number;
    stake1: number;
    stake2: number;
    takeProfit: number;
    stopLoss: number;
    martingale: number;
}

export interface AutoSignalsRun {
    symbol: string;
    action: AutoSignalAction;
    strategy: AutoSignalStrategy;
    startedAt: number;
    maxRuns: number;
    completedRuns: number;
}

export interface AutoSignalsPageProps {
    connected: boolean;
    authorized: boolean;
    status: 'idle' | 'loading' | 'scanning' | 'error';
    message: string;
    markets: AutoSignalMarket[];
    family: AutoSignalFamily;
    settings: AutoSignalsSettings;
    currency: string;
    displayCurrency: string;
    activeRun: AutoSignalsRun | null;
    onFamilyChange: (family: AutoSignalFamily) => void;
    onSettingsChange: <K extends keyof AutoSignalsSettings>(
        key: K,
        value: AutoSignalsSettings[K],
    ) => void;
    onRefresh: () => void;
    onTrade: (market: AutoSignalMarket, action: AutoSignalAction) => void | Promise<void>;
}
