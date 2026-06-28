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
    DCIRCLES: 3,
    SPEEDLAB: 4,
    HEDGE: 5,
    CHART: 6,
    MANUAL_TRADER: 7,
    AUTO_TRADES: 8,
    COPY_TRADING: 9,
    REPORT: 10,
    BULK_TRADE: 11,
    TUTORIAL: 12,
    BOT_BUILDER: 99,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-ahmed-learning',
    'id-bot-library',
    'id-charts',
    'id-tutorials',
    'id-dcircles',
    'id-bulk-trade',
    'id-hedge',
    'id-speedlab',
    'id-auto-trades',
    'id-copy-trading',
    'id-report',
    'id-manual-trader',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
