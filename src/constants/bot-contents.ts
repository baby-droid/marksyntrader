type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    FREE_BOTS: 0,
    DASHBOARD: 1,
    BOT_BUILDER: 2,
    DCIRCLES: 3,
    SPEED_LAB: 4,
    PRO_HEDGE: 5,
    CHART: 6,
    MANUAL_TRADER: 7,
    TUTORIAL: 8,
    BOT_LIBRARY: 9,
    COPY_TRADING: 10,
    REPORTS: 11,
    BULK_TRADE: 12,
    ANALYSIS: 13,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-free-bots',
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-dcircles',
    'id-speed-lab',
    'id-pro-hedge',
    'id-charts',
    'id-manual-trader',
    'id-tutorials',
    'id-bot-library',
    'id-copy-trading',
    'id-reports',
    'id-bulk-trade',
    'id-analysis',
];

export const DEBOUNCE_INTERVAL_TIME = 500;

/** All markets including Jump, Bear, Bull for use in market selectors */
export const ALL_MARKETS = [
    // Volatility Indices
    { label: 'V10', value: 'R_10' },
    { label: 'V25', value: 'R_25' },
    { label: 'V50', value: 'R_50' },
    { label: 'V75', value: 'R_75' },
    { label: 'V100', value: 'R_100' },
    // 1s Indices
    { label: 'V10 1s', value: '1HZ10V' },
    { label: 'V25 1s', value: '1HZ25V' },
    { label: 'V50 1s', value: '1HZ50V' },
    { label: 'V75 1s', value: '1HZ75V' },
    { label: 'V100 1s', value: '1HZ100V' },
    // Crash/Boom
    { label: 'C300', value: 'CRASH300N' },
    { label: 'C500', value: 'CRASH500' },
    { label: 'C1000', value: 'CRASH1000' },
    { label: 'B300', value: 'BOOM300N' },
    { label: 'B500', value: 'BOOM500' },
    { label: 'B1000', value: 'BOOM1000' },
    // Jump Markets
    { label: 'Jump 10', value: 'JD10' },
    { label: 'Jump 25', value: 'JD25' },
    { label: 'Jump 50', value: 'JD50' },
    { label: 'Jump 75', value: 'JD75' },
    { label: 'Jump 100', value: 'JD100' },
];
