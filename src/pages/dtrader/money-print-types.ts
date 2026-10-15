import type { AutoLabSettings, AutoLabTrade } from '../auto-lab/AutoLabView';
import type { AutoLabMode } from '../auto-lab/auto-lab-engine';
import type { AutoLabMarket, AutoLabSignal } from '../auto-lab/AutoLabView';

export type MoneyPrintSection =
    | 'dashboard'
    | 'settings'
    | 'modes'
    | 'markets'
    | 'strategy'
    | 'reports'
    | 'admin';

export interface MoneyPrintPrefs {
    mode: 'accumulation' | 'challenge' | 'growth' | 'earnings' | 'sessions' | 'flip';
    autoStake: boolean;
    riskPercent: number;
    maxStake: number;
    martingaleEnabled: boolean;
    scheduledSessions: boolean;
    strategyMode: AutoLabMode;
    challenge: string;
    goalBalance: number;
    days: number;
    hourlyTarget: number;
}

export interface GoalPlan {
    startBalance: number;
    targetBalance: number;
    remaining: number;
    days: number;
    requiredDailyProfit: number;
    requiredDailyReturnPercent: number;
    stake: number;
    stakeRiskPercent: number | null;
    takeProfit: number;
    stopLoss: number;
    minimumBalanceForConfiguredRisk: number | null;
    planStatus: 'ready' | 'goal-reached' | 'invalid';
}

export interface MoneyPrintRanking {
    label: string;
    currency: string;
    trades: number;
    wins: number;
    losses: number;
    netProfit: number;
    winRate: number | null;
}

export interface MoneyPrintAdminAnalytics {
    activeAccounts10m: number;
    demoAccounts10m: number;
    realAccounts10m: number;
    settledTrades: number;
    wins: number;
    losses: number;
    netProfitByCurrency: Array<{ currency: string; netProfit: number }>;
    bestMarkets: MoneyPrintRanking[];
    bestStrategies: MoneyPrintRanking[];
    bestTradeTypes: MoneyPrintRanking[];
    bestBarriers: MoneyPrintRanking[];
    bestDurations: MoneyPrintRanking[];
    updatedAt: string;
}

export interface MoneyPrintPageData {
    page: MoneyPrintSection;
    settings: AutoLabSettings;
    prefs: MoneyPrintPrefs;
    trades: AutoLabTrade[];
    markets: AutoLabMarket[];
    signal: AutoLabSignal;
    goalPlan: GoalPlan;
    currency: string;
    accountBalance: number | null;
    accountAuthorized: boolean;
    accountIsReal: boolean;
    liveAcknowledged: boolean;
    adminUnlocked: boolean;
    adminLoading: boolean;
    adminError: string;
    adminAnalytics: MoneyPrintAdminAnalytics | null;
    onSetting: <K extends keyof AutoLabSettings>(key: K, value: AutoLabSettings[K]) => void;
    onPref: <K extends keyof MoneyPrintPrefs>(key: K, value: MoneyPrintPrefs[K]) => void;
    onLiveAcknowledged: (value: boolean) => void;
    onModeSelect: (mode: MoneyPrintPrefs['mode']) => void;
    onOpenSettings: () => void;
    onStart: () => void;
    onSaveGoal: () => void;
    onUnlockAdmin: (pin: string) => Promise<boolean>;
    onLockAdmin: () => void;
    onRefreshAdmin: () => void;
    onExportReport: () => void;
    onPrintReport: () => void;
}
