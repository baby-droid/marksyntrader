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
    DASHBOARD: 0,
    AUTO_SIGNALS: 1,
    AHMED_LEARNING: 2,
    FREE_BOTS: 3,
    AHMED_SCALPER_BOTS: 4,
    AUTO_DIGITS: 5,
    AUTO_LAB: 6,
    DCIRCLES: 7,
    SPEEDLAB: 8,
    HEDGE: 9,
    CHART: 10,
    MANUAL_TRADER: 11,
    DTRADER: 12,
    AUTO_TRADES: 13,
    COPY_TRADING: 14,
    REPORT: 15,
    BULK_TRADE: 16,
    ANALYSIS: 17,
    TUTORIAL: 18,
    TRADING_SOFTWARE: 19,
    // BOT_BUILDER is an alias for the Bot Builder tab (AHMED_LEARNING). It must stay
    // equal to AHMED_LEARNING's index — the Tabs component renders nothing when
    // active_tab doesn't match any child index, so a standalone sentinel value here
    // (e.g. 99) silently blanks the screen when clicked from Dashboard cards, the
    // saved-bot list, tours, or announcements.
    BOT_BUILDER: 2,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-auto-signals',
    'id-ahmed-learning',
    'id-bot-library',
    'id-scalper-bots',
    'id-auto-digits',
    'id-auto-lab',
    'id-dcircles',
    'id-speed-lab',
    'id-pro-hedge',
    'id-charts',
    'id-manual-trader',
    'id-dtrader',
    'id-auto-trades',
    'id-copy-trading',
    'id-reports',
    'id-bulk-trade',
    'id-analysis',
    'id-tutorial',
    'id-trading-software',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
