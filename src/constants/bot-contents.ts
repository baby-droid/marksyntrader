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
    BOT_BUILDER: 1,
    CHART: 2,
    TUTORIAL: 3,
    BOT_LIBRARY: 4,
    DCIRCLES: 5,
    BULK_TRADE: 6,
    HEDGE: 7,
    SPEEDLAB: 8,
    AUTO_TRADES: 9,
    COPY_TRADING: 10,
    REPORT: 11,
    MANUAL_TRADER: 12,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-tutorials',
    'id-bot-library',
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
