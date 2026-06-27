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
];

export const DEBOUNCE_INTERVAL_TIME = 500;
