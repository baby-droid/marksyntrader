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
    AHMED_LEARNING: 1,
    FREE_BOTS: 2,
    AHMED_SCALPER_BOTS: 3,
    AUTO_DIGITS: 4,
    DCIRCLES: 5,
    SPEEDLAB: 6,
    HEDGE: 7,
    CHART: 8,
    MANUAL_TRADER: 9,
    DTRADER: 10,
    AUTO_TRADES: 11,
    COPY_TRADING: 12,
    REPORT: 13,
    BULK_TRADE: 14,
    ANALYSIS: 15,
    TUTORIAL: 16,
    TRADING_SOFTWARE: 17,
    // BOT_BUILDER is an alias for the Bot Builder tab (AHMED_LEARNING). It must stay
    // equal to AHMED_LEARNING's index — the Tabs component renders nothing when
    // active_tab doesn't match any child index, so a standalone sentinel value here
    // (e.g. 99) silently blanks the screen when clicked from Dashboard cards, the
    // saved-bot list, tours, or announcements.
    BOT_BUILDER: 1,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-ahmed-learning',
    'id-bot-library',
    'id-scalper-bots',
    'id-auto-digits',
    'id-dcircles',
    'id-speedlab',
    'id-hedge',
    'id-charts',
    'id-manual-trader',
    'id-dtrader',
    'id-auto-trades',
    'id-copy-trading',
    'id-report',
    'id-bulk-trade',
    'id-tutorials',
    'id-trading-software',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
