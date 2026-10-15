import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    ArrowUpRight,
    BarChart3,
    BrainCircuit,
    CalendarClock,
    CheckCircle2,
    CircleStop,
    Clock3,
    Download,
    Lightbulb,
    Pause,
    Play,
    Printer,
    Radio,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Target,
    TrendingUp,
    Wallet,
    Zap,
} from 'lucide-react';
import { useAutoLabEngine } from '../auto-lab/useAutoLabEngine';
import {
    AUTO_LAB_CONTRACT_TYPES,
    AUTO_LAB_MODES,
    type AutoLabContractType,
    type AutoLabMode,
} from '../auto-lab/auto-lab-engine';
import type { AutoLabSettings, AutoLabTrade } from '../auto-lab/AutoLabView';
import { formatMoney, fromUsd, getDisplayCurrency, subscribeCurrency, toUsd } from '@/utils/currency-display';
import { calculateAutoStake, MIN_DERIV_STAKE, usesUnchangedLegacyAutoStakeDefaults } from './money-print-utils';
import MoneyPrintNeuralLink, { getMatchRouteKey, type MatchRoute } from './MoneyPrintNeuralLink';
import MoneyPrintErrorBoundary from './MoneyPrintErrorBoundary';
import {
    createMoneyPrintNeuralReport,
    findMoneyPrintLosingSide,
    rankMoneyPrintMatchRoutes,
    summarizeMoneyPrintTrades,
    type MoneyPrintNeuralReport,
} from './money-print-neural-analysis';
import { downloadMoneyPrintReportImage } from './money-print-report-image';
import './dtrader.scss';

type MoneyMode = 'accumulation' | 'challenge' | 'growth' | 'earnings' | 'sessions' | 'flip';
type MoneyPrintPrefs = {
    mode: MoneyMode;
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
};

const SETTINGS_KEY = 'money_print_settings_v2';
const LEGACY_SETTINGS_KEY = 'money_print_settings_v1';
const PREFS_KEY = 'money_print_prefs_v2';
const LEGACY_PREFS_KEY = 'money_print_prefs_v1';
const JOURNAL_KEY = 'money_print_journal_v1';
const BASE_SETTINGS: AutoLabSettings = {
    marketSelection: 'ALL',
    contractType: 'AUTO',
    stake: MIN_DERIV_STAKE,
    martingaleMode: 'normal',
    multiplier: 1.8,
    maxMartingaleLevel: 2,
    takeProfit: 2,
    stopLoss: 3,
    ticksWindow: 50,
    thresholdPercent: 60,
    barrier: 4,
    autoBarrier: true,
    contractBarrier: 4,
    matchEntryDigit: null,
    secondaryBarrier: 5,
    requiredStreak: 3,
    duration: 1,
    durationUnit: 't',
    contractMultiplier: 2,
    growthRate: 3,
    barrierRange: 'middle',
    selectedTick: 1,
    virtualLossesRequired: 0,
    virtualWinsRequired: 0,
};
const BASE_PREFS: MoneyPrintPrefs = {
    mode: 'accumulation',
    autoStake: false,
    riskPercent: 0.5,
    maxStake: 2,
    martingaleEnabled: false,
    scheduledSessions: false,
    strategyMode: 'Multimarket',
    challenge: '',
    goalBalance: 20,
    days: 7,
    hourlyTarget: 1.8,
};
const storageWarnings = new Set<string>();
const safeWriteMoneyPrintStorage = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        if (!storageWarnings.has(key)) {
            storageWarnings.add(key);
            console.warn('Money Print could not persist local data in this browser.', error);
        }
        return false;
    }
};
const CONTRACT_LABELS: Record<AutoLabContractType, string> = {
    CALL: 'Rise',
    PUT: 'Fall',
    DIGITEVEN: 'Even',
    DIGITODD: 'Odd',
    DIGITOVER: 'Over',
    DIGITUNDER: 'Under',
    DIGITMATCH: 'Matches',
    DIGITDIFF: 'Differs',
    CALLSPREAD: 'Call spread',
    PUTSPREAD: 'Put spread',
    ONETOUCH: 'Touch',
    RANGE: 'Range',
    TICKHIGH: 'High tick',
    TICKLOW: 'Low tick',
    ACCU: 'Accumulator',
    MULTUP: 'Multiplier up',
    MULTDOWN: 'Multiplier down',
    LBFLOATCALL: 'Lookback rise',
    LBFLOATPUT: 'Lookback fall',
    LBHIGHLOW: 'Lookback high/low',
};
const MODE_CARDS: { id: MoneyMode; title: string; note: string; icon: React.ReactNode }[] = [
    { id: 'accumulation', title: 'Accumulation', note: 'Set a session target and compound carefully.', icon: <TrendingUp /> },
    { id: 'challenge', title: 'Challenge', note: 'Describe a goal; risk limits still control every entry.', icon: <Target /> },
    { id: 'growth', title: 'Growth', note: 'Plan toward a balance goal over a chosen number of days.', icon: <Sparkles /> },
    { id: 'earnings', title: 'Hourly earnings', note: 'Pause after the target or loss limit is reached.', icon: <Clock3 /> },
    { id: 'sessions', title: 'Scheduled sessions', note: 'Trade only during the selected East Africa windows.', icon: <CalendarClock /> },
    { id: 'flip', title: 'Auto Flip · demo only', note: 'Experimental high-risk mode; never promises a fast return.', icon: <Zap /> },
];
const SESSION_WINDOWS = [
    { id: 'early', label: '03:00–06:00', start: 180, end: 360 },
    { id: 'midday', label: '11:00–13:00', start: 660, end: 780 },
    { id: 'afternoon', label: '16:00–18:00', start: 960, end: 1080 },
    { id: 'late', label: '21:00–23:00', start: 1260, end: 1380 },
];
const STORAGE_JOURNAL_LIMIT = 500;
const NEURAL_RISK_LOCK_KEY = 'money_print_neural_risk_lock_v1';
const NEURAL_RISK_LOCK_MS = 5 * 60 * 60 * 1000;
const readNeuralRiskLock = (loginId: string): number | null => {
    if (!loginId) return null;
    try {
        const raw = localStorage.getItem(`${NEURAL_RISK_LOCK_KEY}:${loginId}`);
        const until = raw == null ? NaN : Number(raw);
        return Number.isFinite(until) && until > 0 ? until : null;
    } catch {
        return null;
    }
};
const safeRead = <T,>(key: string, fallback: T): T => {
    try {
        const saved = localStorage.getItem(key);
        return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
    } catch {
        return fallback;
    }
};
const readSettings = (): AutoLabSettings => {
    try {
        const current = localStorage.getItem(SETTINGS_KEY);
        if (current) return { ...BASE_SETTINGS, ...JSON.parse(current) };

        const legacy = localStorage.getItem(LEGACY_SETTINGS_KEY);
        if (!legacy) return BASE_SETTINGS;
        const saved = JSON.parse(legacy);
        const oldDefaults: AutoLabSettings = { ...BASE_SETTINGS, stake: 1 };
        const hadUnchangedDefaults = Object.entries(oldDefaults).every(
            ([key, value]) => saved[key] === value,
        );
        const migrated = {
            ...BASE_SETTINGS,
            ...saved,
            ...(hadUnchangedDefaults ? { stake: MIN_DERIV_STAKE } : {}),
        };
        safeWriteMoneyPrintStorage(SETTINGS_KEY, JSON.stringify(migrated));
        return migrated;
    } catch {
        return BASE_SETTINGS;
    }
};
const readPrefs = (): MoneyPrintPrefs => {
    try {
        const current = localStorage.getItem(PREFS_KEY);
        if (current) return { ...BASE_PREFS, ...JSON.parse(current) };

        const legacy = localStorage.getItem(LEGACY_PREFS_KEY);
        if (!legacy) return BASE_PREFS;
        const saved = JSON.parse(legacy);
        const migrated = {
            ...BASE_PREFS,
            ...saved,
            ...(usesUnchangedLegacyAutoStakeDefaults(saved) ? { autoStake: false } : {}),
        };
        safeWriteMoneyPrintStorage(PREFS_KEY, JSON.stringify(migrated));
        return migrated;
    } catch {
        return BASE_PREFS;
    }
};
const getEastAfricaTime = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Nairobi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const part = (name: string) => parts.find(item => item.type === name)?.value ?? '00';
    const year = part('year');
    const month = part('month');
    const day = part('day');
    const hour = Number(part('hour'));
    const minute = Number(part('minute'));
    return {
        key: `${year}-${month}-${day}`,
        time: `${part('hour')}:${part('minute')}`,
        minutes: hour * 60 + minute,
    };
};
const money = (amount: number | null | undefined, accountCurrency = 'USD') => {
    if (amount == null || !Number.isFinite(amount)) return '—';
    return accountCurrency && accountCurrency !== 'USD'
        ? `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${accountCurrency}`
        : formatMoney(amount);
};
const mergeJournal = (saved: AutoLabTrade[], incoming: AutoLabTrade[]) => {
    const byId = new Map(saved.map(trade => [trade.id, trade]));
    const incomingIds: string[] = [];
    incoming.forEach(trade => {
        byId.set(trade.id, { ...byId.get(trade.id), ...trade });
        incomingIds.push(trade.id);
    });
    const orderedIds = [...new Set([...incomingIds, ...saved.map(trade => trade.id)])];
    return orderedIds
        .map(id => byId.get(id))
        .filter((trade): trade is AutoLabTrade => Boolean(trade))
        .slice(0, STORAGE_JOURNAL_LIMIT);
};

const tradeSnapshot = (trade: AutoLabTrade) =>
    `${trade.status}|${trade.profit}|${trade.stake}|${trade.market}|${trade.contract}`;

const DTraderContent: React.FC = () => {
    const [settings, setSettings] = useState<AutoLabSettings>(readSettings);
    const [prefs, setPrefs] = useState<MoneyPrintPrefs>(readPrefs);
    const [liveAcknowledged, setLiveAcknowledged] = useState(false);
    const [, setDisplayCurrency] = useState(getDisplayCurrency());
    const [journal, setJournal] = useState<AutoLabTrade[]>([]);
    const [neuralReport, setNeuralReport] = useState<MoneyPrintNeuralReport | null>(null);
    const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);
    const [autoMatchArmed, setAutoMatchArmed] = useState(false);
    const [riskLockState, setRiskLockState] = useState<{ loginId: string; until: number } | null>(null);
    const [clock, setClock] = useState(() => getEastAfricaTime());
    const [notice, setNotice] = useState('');
    const [activePanel, setActivePanel] = useState<'dashboard' | 'settings' | 'reports'>('dashboard');
    const previousAccountRef = useRef('');
    const riskLockStateRef = useRef(riskLockState);
    const scheduleStartedRef = useRef('');
    const scheduledRunRef = useRef(false);
    const scheduleEndRef = useRef(0);
    const activeRunAccountRef = useRef('');
    const tradeSnapshotsRef = useRef(new Map<string, string>());
    const pendingMatchStartRef = useRef<string | null>(null);
    const pendingSettlementIdsRef = useRef(new Set<string>());

    useEffect(() => subscribeCurrency(() => setDisplayCurrency(getDisplayCurrency())), []);
    useEffect(() => {
        const timer = window.setInterval(() => setClock(getEastAfricaTime()), 30_000);
        return () => window.clearInterval(timer);
    }, []);
    useEffect(() => {
        safeWriteMoneyPrintStorage(SETTINGS_KEY, JSON.stringify(settings));
    }, [settings]);
    useEffect(() => {
        safeWriteMoneyPrintStorage(PREFS_KEY, JSON.stringify(prefs));
    }, [prefs]);

    const effectiveStakeFromPrefs = (balance: number | null) => {
        if (!prefs.autoStake) return settings.stake;
        return calculateAutoStake(balance, prefs.riskPercent, prefs.maxStake);
    };

    const engine = useAutoLabEngine(
        prefs.strategyMode,
        settings,
        liveAcknowledged,
        'all-synthetic',
        {
            autoStake: prefs.autoStake,
            riskPercent: prefs.riskPercent,
            maxStake: prefs.maxStake,
            martingaleEnabled: prefs.martingaleEnabled,
        },
        true,
    );
    const autoStake = effectiveStakeFromPrefs(engine.account.balance);
    const engineRef = useRef(engine);
    engineRef.current = engine;
    const matchRoutes = useMemo(() => rankMoneyPrintMatchRoutes(engine.markets), [engine.markets]);
    const selectedMatch = matchRoutes.find(route => route.key === selectedMatchKey) ?? null;
    const persistedRiskLock = readNeuralRiskLock(engine.account.loginId);
    const stateRiskLock = riskLockState?.loginId === engine.account.loginId ? riskLockState.until : null;
    const riskLockUntil = Math.max(persistedRiskLock ?? 0, stateRiskLock ?? 0) || null;
    const riskLockActive = riskLockUntil != null && riskLockUntil > Date.now();
    riskLockStateRef.current = riskLockState;

    useEffect(() => {
        if (!matchRoutes.length) {
            setSelectedMatchKey(null);
            return;
        }
        setSelectedMatchKey(current =>
            current && matchRoutes.some(route => route.key === current)
                ? current
                : (matchRoutes.find(route => route.eligible) ?? matchRoutes[0]).key,
        );
    }, [matchRoutes]);

    useEffect(() => {
        if (!engine.account.loginId) {
            setRiskLockState(null);
            setNeuralReport(null);
            setAutoMatchArmed(false);
            pendingMatchStartRef.current = null;
            setJournal([]);
            setLiveAcknowledged(false);
            tradeSnapshotsRef.current.clear();
            pendingSettlementIdsRef.current.clear();
            return;
        }
        activeRunAccountRef.current = '';
        tradeSnapshotsRef.current = new Map(engineRef.current.trades.map(trade => [trade.id, tradeSnapshot(trade)]));
        pendingSettlementIdsRef.current.clear();
        setRiskLockState({
            loginId: engine.account.loginId,
            until: readNeuralRiskLock(engine.account.loginId) ?? 0,
        });
        setNeuralReport(null);
        setSelectedMatchKey(null);
        setAutoMatchArmed(false);
        pendingMatchStartRef.current = null;
        if (previousAccountRef.current && previousAccountRef.current !== engine.account.loginId) {
            setLiveAcknowledged(false);
            setNotice('Account changed. Review the selected account and confirm again before live trading.');
        }
        previousAccountRef.current = engine.account.loginId;
        const accountKey = `${JOURNAL_KEY}:${engine.account.loginId}`;
        try {
            const saved = localStorage.getItem(accountKey);
            const parsed = saved ? JSON.parse(saved) : [];
            setJournal(Array.isArray(parsed)
                ? parsed.filter((trade): trade is AutoLabTrade =>
                    Boolean(trade && typeof trade === 'object' && typeof trade.id === 'string'),
                )
                : []);
        } catch {
            setJournal([]);
        }
    }, [engine.account.loginId]);

    useEffect(() => {
        if (!engine.account.loginId || engine.trades.length === 0) return;
        if (activeRunAccountRef.current !== engine.account.loginId) return;
        const currentRunTrades = engine.trades.filter(trade =>
            tradeSnapshotsRef.current.get(trade.id) !== tradeSnapshot(trade),
        );
        if (!currentRunTrades.length) return;
        currentRunTrades.forEach(trade => tradeSnapshotsRef.current.set(trade.id, tradeSnapshot(trade)));
        currentRunTrades
            .filter(trade => trade.status === 'WIN' || trade.status === 'LOSS')
            .forEach(trade => pendingSettlementIdsRef.current.add(trade.id));
        setJournal(previous => {
            const next = mergeJournal(previous, currentRunTrades);
            if (!safeWriteMoneyPrintStorage(
                `${JOURNAL_KEY}:${engine.account.loginId}`,
                JSON.stringify(next),
            )) {
                setNotice('This browser could not save the local trade journal.');
            }
            return next;
        });
    }, [engine.account.loginId, engine.trades]);

    useEffect(() => {
        const update = () => {
            if (!engine.account.loginId) return;
            const activeId = localStorage.getItem('active_loginid') || '';
            if (activeId && activeId !== engine.account.loginId) {
                setLiveAcknowledged(false);
            }
        };
        window.addEventListener('storage', update);
        return () => window.removeEventListener('storage', update);
    }, [engine.account.loginId]);

    useEffect(() => {
        const scheduleTick = () => {
            const current = engineRef.current;
            const currentPrefs = safeRead(PREFS_KEY, BASE_PREFS);
            const shouldSchedule = currentPrefs.scheduledSessions;
            const persistedLock = readNeuralRiskLock(current.account.loginId);
            const memoryLock = riskLockStateRef.current?.loginId === current.account.loginId
                ? riskLockStateRef.current.until
                : null;
            const savedLock = Math.max(persistedLock ?? 0, memoryLock ?? 0) || null;
            const isLocked = savedLock != null && savedLock > Date.now();
            if (isLocked) {
                setRiskLockState(currentLock =>
                    currentLock?.loginId === current.account.loginId && currentLock.until === savedLock
                        ? currentLock
                        : { loginId: current.account.loginId, until: savedLock },
                );
                if (
                    scheduledRunRef.current
                    || ['running', 'scanning', 'connecting'].includes(current.status)
                ) {
                    current.onStop();
                    scheduledRunRef.current = false;
                    scheduleEndRef.current = Date.now();
                }
                return;
            }
            const activeWindow = SESSION_WINDOWS.find(window =>
                clock.minutes >= window.start && clock.minutes < window.end,
            );
            const scheduleKey = activeWindow ? `${clock.key}:${activeWindow.id}` : '';

            if (!shouldSchedule || !activeWindow) {
                const shouldStopRun = scheduledRunRef.current
                    || (shouldSchedule && ['running', 'scanning', 'connecting'].includes(current.status));
                if (shouldStopRun) {
                    current.onStop();
                    scheduledRunRef.current = false;
                    scheduleEndRef.current = Date.now();
                }
                return;
            }

            if (
                scheduleKey
                && scheduleKey !== scheduleStartedRef.current
                && Date.now() - scheduleEndRef.current >= 15 * 60 * 1000
                && current.canStart
                && current.status !== 'running'
                && current.status !== 'scanning'
                && current.status !== 'connecting'
            ) {
                scheduleStartedRef.current = scheduleKey;
                scheduledRunRef.current = true;
                activeRunAccountRef.current = current.account.loginId;
                tradeSnapshotsRef.current = new Map(current.trades.map(trade => [trade.id, tradeSnapshot(trade)]));
                current.onStart();
            }
        };

        const timer = window.setInterval(scheduleTick, 5_000);
        scheduleTick();
        return () => window.clearInterval(timer);
    }, [clock.key, clock.minutes]);

    useEffect(() => () => {
        if (scheduledRunRef.current) engineRef.current.onStop();
        else if (['running', 'scanning', 'connecting'].includes(engineRef.current.status)) engineRef.current.onStop();
    }, []);

    const patchSetting = <K extends keyof AutoLabSettings>(key: K, value: AutoLabSettings[K]) => {
        if (riskLockActive) {
            setNotice('Trade settings are locked until the five-hour risk pause ends.');
            return;
        }
        setSettings(previous => ({ ...previous, [key]: value }));
    };
    const patchPrefs = <K extends keyof MoneyPrintPrefs>(key: K, value: MoneyPrintPrefs[K]) => {
        if (
            riskLockActive
            && !(['challenge', 'goalBalance', 'days', 'hourlyTarget'] as Array<keyof MoneyPrintPrefs>).includes(key)
        ) {
            setNotice('Trading controls are locked until the five-hour risk pause ends.');
            return;
        }
        setPrefs(previous => ({ ...previous, [key]: value }));
    };
    const selectMode = (mode: MoneyMode) => {
        if (riskLockActive) {
            setNotice('Trade modes are locked until the five-hour risk pause ends.');
            return;
        }
        if (mode === 'flip' && engine.account.isVirtual === false) {
            setNotice('Auto Flip is restricted to a verified demo account.');
            return;
        }
        patchPrefs('mode', mode);
        setNotice(mode === 'sessions'
            ? 'Scheduled sessions use East Africa time and stop when the window or risk limit ends.'
            : '');
    };
    const accountIsReal = engine.account.isVirtual === false;
    const accountIsDemo = engine.account.isVirtual === true;
    const sessionWindow = SESSION_WINDOWS.find(window =>
        clock.minutes >= window.start && clock.minutes < window.end,
    );
    const sessionTitle = sessionWindow?.label ?? 'Outside trading window';
    const settledJournal = useMemo(
        () => journal.filter(trade => trade.status !== 'OPEN'),
        [journal],
    );
    const wins = settledJournal.filter(trade => trade.status === 'WIN').length;
    const losses = settledJournal.filter(trade => trade.status === 'LOSS').length;
    const winRate = wins + losses ? (wins / (wins + losses)) * 100 : null;
    const topMarket = useMemo(() => {
        const netByMarket = new Map<string, number>();
        settledJournal.forEach(trade => netByMarket.set(
            trade.market,
            (netByMarket.get(trade.market) ?? 0) + (Number(trade.profit) || 0),
        ));
        return [...netByMarket.entries()].sort((a, b) => b[1] - a[1])[0];
    }, [settledJournal]);
    const latestTrades = useMemo(() => [...journal].slice(0, 12), [journal]);
    const openCount = engine.trades.filter(trade => trade.status === 'OPEN').length;
    const effectiveStakeDisplay = prefs.autoStake ? autoStake : settings.stake;
    const canStart = engine.canStart
        && autoStake >= MIN_DERIV_STAKE
        && (!accountIsReal || liveAcknowledged)
        && !(prefs.mode === 'flip' && !accountIsDemo)
        && !riskLockActive;
    const connectionCopy = !engine.account.connected
        ? 'Not connected'
        : !engine.account.authorized
            ? 'Sign in to Deriv'
            : accountIsDemo
                ? 'Demo account'
                : accountIsReal
                    ? 'Real account'
                    : 'Account type unknown';

    const exportCsv = () => {
        const rows = [
            ['Contract ID', 'Time', 'Market', 'Contract', 'Stake', 'Profit', 'Result'],
            ...journal.map(trade => [
                trade.id,
                trade.time,
                trade.market,
                trade.contract,
                String(trade.stake),
                String(trade.profit),
                trade.status,
            ]),
        ];
        const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `money-print-report-${clock.key}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const runButton = () => {
        const savedLock = readNeuralRiskLock(engine.account.loginId);
        if (riskLockActive || (savedLock != null && savedLock > Date.now())) {
            if (savedLock != null) setRiskLockState({ loginId: engine.account.loginId, until: savedLock });
            setNotice('DO NOT TRADE: the account risk lock is active. New entries stay disabled until it expires.');
            return;
        }
        if (prefs.mode === 'flip' && !accountIsDemo) {
            setNotice('Auto Flip is demo-only. Switch to a verified demo account to run it.');
            return;
        }
        if (accountIsReal && !liveAcknowledged) {
            setNotice('Confirm real-account trading in Trade Settings before starting.');
            setActivePanel('settings');
            return;
        }
        if (effectiveStakeDisplay < MIN_DERIV_STAKE) {
            setNotice('The account-based stake is below Deriv’s minimum. Turn off auto stake to use the fixed base stake, or change the risk settings deliberately.');
            setActivePanel('settings');
            return;
        }
        if (!engine.canStart) {
            setNotice(engine.message || 'Wait for live market data and an available setup before starting.');
            return;
        }
        setNotice('');
        activeRunAccountRef.current = engine.account.loginId;
        tradeSnapshotsRef.current = new Map(engine.trades.map(trade => [trade.id, tradeSnapshot(trade)]));
        engine.onStart();
    };

    const activateNeuralRiskLock = (losingSide: string) => {
        const loginId = engineRef.current.account.loginId;
        const existingLock = loginId ? readNeuralRiskLock(loginId) : null;
        const until = existingLock != null && existingLock > Date.now()
            ? existingLock
            : Date.now() + NEURAL_RISK_LOCK_MS;
        if (loginId) {
            if (!safeWriteMoneyPrintStorage(`${NEURAL_RISK_LOCK_KEY}:${loginId}`, String(until))) {
                setNotice('Storage is unavailable. Trading is stopped for this page session, but the five-hour lock could not be saved.');
            }
            setRiskLockState({ loginId, until });
        }
        pendingMatchStartRef.current = null;
        setAutoMatchArmed(false);
        scheduledRunRef.current = false;
        scheduleEndRef.current = Date.now();
        engineRef.current.onStop();
        setNotice(`DO NOT TRADE: ${losingSide} met the loss guard. New Money Print entries are disabled for five hours.`);
    };

    const analyzeChallenge = () => {
        const report = createMoneyPrintNeuralReport({
            challenge: prefs.challenge,
            trades: journal,
            matches: matchRoutes,
            accountContext: {
                accountType: accountIsDemo ? 'Demo' : accountIsReal ? 'Real' : 'Unknown',
                balance: engine.account.balance,
                currency: engine.account.currency || 'USD',
                baseStake: settings.stake,
                nextStake: effectiveStakeDisplay,
                autoStake: prefs.autoStake,
                riskPercent: prefs.riskPercent,
                maxStake: prefs.maxStake,
                takeProfit: settings.takeProfit,
                stopLoss: settings.stopLoss,
                sessionPnl: engine.session.pnl,
                strategyMode: prefs.strategyMode,
                scheduledSessions: prefs.scheduledSessions,
            },
        });
        setNeuralReport(report);
        if (report.losingSide) activateNeuralRiskLock(report.losingSide);
    };

    useEffect(() => {
        if (!engine.account.loginId || !pendingSettlementIdsRef.current.size) return;
        const settledIds = [...pendingSettlementIdsRef.current].filter(id =>
            journal.some(trade => trade.id === id && (trade.status === 'WIN' || trade.status === 'LOSS')),
        );
        if (!settledIds.length) return;
        settledIds.forEach(id => pendingSettlementIdsRef.current.delete(id));
        const losingSide = findMoneyPrintLosingSide(summarizeMoneyPrintTrades(journal));
        if (!losingSide) return;

        const report = createMoneyPrintNeuralReport({
            challenge: prefs.challenge,
            trades: journal,
            matches: matchRoutes,
            accountContext: {
                accountType: accountIsDemo ? 'Demo' : accountIsReal ? 'Real' : 'Unknown',
                balance: engine.account.balance,
                currency: engine.account.currency || 'USD',
                baseStake: settings.stake,
                nextStake: effectiveStakeDisplay,
                autoStake: prefs.autoStake,
                riskPercent: prefs.riskPercent,
                maxStake: prefs.maxStake,
                takeProfit: settings.takeProfit,
                stopLoss: settings.stopLoss,
                sessionPnl: engine.session.pnl,
                strategyMode: prefs.strategyMode,
                scheduledSessions: prefs.scheduledSessions,
            },
        });
        setNeuralReport(report);
        activateNeuralRiskLock(losingSide);
    }, [
        accountIsDemo,
        accountIsReal,
        effectiveStakeDisplay,
        engine.account.balance,
        engine.account.currency,
        engine.account.loginId,
        engine.session.pnl,
        journal,
        matchRoutes,
        prefs.autoStake,
        prefs.challenge,
        prefs.maxStake,
        prefs.riskPercent,
        prefs.scheduledSessions,
        prefs.strategyMode,
        settings.stake,
        settings.stopLoss,
        settings.takeProfit,
    ]);

    const canAutoMatch = Boolean(
        selectedMatch?.eligible
        && !riskLockActive
        && selectedMatch.tickCount >= 20
        && engine.account.connected
        && engine.account.authorized
        && engine.account.isVirtual != null
        && autoStake >= MIN_DERIV_STAKE
        && (!accountIsReal || liveAcknowledged)
        && !['running', 'scanning', 'connecting'].includes(engine.status),
    );
    const autoMatchBlockReason = riskLockActive
        ? 'The five-hour loss lock is active; trading settings and new entries are disabled.'
        : !selectedMatch
            ? 'No match route is available yet. Wait for authenticated market history.'
            : !selectedMatch.eligible
                ? 'This route did not pass the sample-size, lift, and confidence checks.'
                : !engine.account.authorized || engine.account.isVirtual == null
                    ? 'Authorize an account and verify whether it is demo or real before arming.'
                    : accountIsReal && !liveAcknowledged
                        ? 'Confirm real-account execution in Trade Settings first.'
                        : autoStake < MIN_DERIV_STAKE
                            ? 'The configured stake is below the Deriv minimum; the risk guard will not round it up.'
                            : ['running', 'scanning', 'connecting'].includes(engine.status)
                                ? 'Stop the current strategy before switching to an auto-match route.'
                                : selectedMatch.tickCount < 20
                                    ? 'Wait for at least twenty valid ticks on the selected authenticated market.'
                                    : '';

    const toggleAutoMatch = (enabled: boolean) => {
        if (!enabled) {
            pendingMatchStartRef.current = null;
            setAutoMatchArmed(false);
            if (
                prefs.strategyMode === 'Matches/Differs'
                && settings.matchEntryDigit != null
                && ['running', 'scanning', 'connecting'].includes(engine.status)
            ) {
                engineRef.current.onStop();
                scheduledRunRef.current = false;
            }
            return;
        }
        if (!selectedMatch || !selectedMatch.eligible || !canAutoMatch) {
            setNotice(autoMatchBlockReason || 'Select a qualified route before enabling auto-match.');
            return;
        }
        if (riskLockActive) {
            setNotice('DO NOT TRADE: the five-hour account risk lock is active.');
            return;
        }
        const route = selectedMatch;
        setNotice('');
        setAutoMatchArmed(true);
        setSettings(previous => ({
            ...previous,
            marketSelection: route.symbol,
            contractType: 'DIGITMATCH',
            ticksWindow: 500,
            barrier: route.targetDigit,
            contractBarrier: route.targetDigit,
            matchEntryDigit: route.entryDigit,
            duration: 1,
            durationUnit: 't',
            autoBarrier: false,
        }));
        setPrefs(previous => ({ ...previous, strategyMode: 'Matches/Differs' }));

        if (prefs.scheduledSessions) {
            pendingMatchStartRef.current = null;
            setNotice(`Auto-match is armed for ${route.label}. The existing EAT session schedule controls when this strategy starts.`);
        } else {
            pendingMatchStartRef.current = route.key;
            setNotice(`Auto-match is configured for ${route.label}. It will start through the existing engine after settings and feed are ready.`);
        }
    };

    useEffect(() => {
        const pendingKey = pendingMatchStartRef.current;
        if (!pendingKey || prefs.scheduledSessions) return;
        if (riskLockActive) {
            pendingMatchStartRef.current = null;
            setAutoMatchArmed(false);
            return;
        }
        const route = matchRoutes.find(item => item.key === pendingKey);
        if (!route?.eligible) {
            pendingMatchStartRef.current = null;
            setAutoMatchArmed(false);
            setNotice('The selected match route is no longer eligible. No trade was started.');
            return;
        }
        const routeConfigured = prefs.strategyMode === 'Matches/Differs'
            && settings.contractType === 'DIGITMATCH'
            && settings.marketSelection === route.symbol
            && settings.matchEntryDigit === route.entryDigit
            && settings.contractBarrier === route.targetDigit;
        if (!routeConfigured || !engine.canStart) return;
        pendingMatchStartRef.current = null;
        runButton();
    }, [
        engine.canStart,
        engine.markets,
        matchRoutes,
        prefs.scheduledSessions,
        prefs.strategyMode,
        riskLockActive,
        settings.contractBarrier,
        settings.contractType,
        settings.marketSelection,
        settings.matchEntryDigit,
    ]);

    const onScheduleSessionsChange = (enabled: boolean) => {
        if (riskLockActive) {
            setNotice('Scheduled trading cannot be changed during the five-hour risk lock.');
            return;
        }
        patchPrefs('scheduledSessions', enabled);
        if (enabled && !sessionWindow && ['running', 'scanning', 'connecting'].includes(engine.status)) {
            engineRef.current.onStop();
            scheduledRunRef.current = false;
            setNotice('Trading stopped outside the selected EAT windows. The schedule will start the selected strategy in the next open window.');
        }
    };

    return (
        <div className='money-print'>
            <header className='mp-header'>
                <div className='mp-brand'>
                    <div className='mp-brand__mark'><BrainCircuit size={26} /></div>
                    <div>
                        <div className='mp-brand__eyebrow'>NEURAL LINK · SMART TRADING</div>
                        <h1>Money <span>Print</span></h1>
                        <p>Plan carefully. Scan live. Protect capital.</p>
                    </div>
                </div>
                <div className='mp-header__right'>
                    <div className='mp-header__quote'>
                        <strong>Trade smarter, not harder.</strong>
                        <span>Market decisions are uncertain. No profit is guaranteed.</span>
                    </div>
                    <div className={`mp-account-badge ${accountIsDemo ? 'is-demo' : accountIsReal ? 'is-real' : ''}`}>
                        <span className='mp-live-dot' />
                        <span>{connectionCopy}</span>
                        <b>{engine.account.currency || '—'}</b>
                    </div>
                </div>
            </header>

            <div className='mp-shell'>
                <nav className='mp-side-nav' aria-label='Money Print sections'>
                    <div className='mp-side-nav__top'>
                        <span className='mp-brand-mini'><BrainCircuit size={15} /></span>
                        <strong>Money Print</strong>
                        <span className='mp-side-nav__account'>{accountIsDemo ? 'DEMO' : accountIsReal ? 'REAL' : '—'}</span>
                    </div>
                    <button className={activePanel === 'dashboard' ? 'active' : ''} onClick={() => setActivePanel('dashboard')}><Activity size={15} /> Dashboard</button>
                    <button className={activePanel === 'settings' ? 'active' : ''} onClick={() => setActivePanel('settings')}><ShieldCheck size={15} /> Trade Settings</button>
                    <button onClick={() => setActivePanel('dashboard')}><Sparkles size={15} /> Trade Modes</button>
                    <button onClick={() => setActivePanel('dashboard')}><Radio size={15} /> Markets & Signals</button>
                    <button onClick={() => setActivePanel('dashboard')}><BrainCircuit size={15} /> Strategy Engine</button>
                    <button className={activePanel === 'reports' ? 'active' : ''} onClick={() => setActivePanel('reports')}><BarChart3 size={15} /> Reports</button>
                    <button onClick={() => setNotice('Platform-wide user data is unavailable in this account-only client.')}><ShieldAlert size={15} /> Admin Insights</button>
                    <div className='mp-side-nav__bottom'>
                        <span className={engine.account.authorized ? 'connected' : ''}><i /> {engine.account.authorized ? 'Deriv link authorized' : 'Connect a Deriv account'}</span>
                        <a href='https://developers.deriv.com/llms.txt' target='_blank' rel='noreferrer'>Deriv API documentation ↗</a>
                    </div>
                </nav>

                <main className='mp-content'>
                    <div className='mp-page-heading'>
                        <div>
                            <span className='mp-kicker'>CONTROL CENTER</span>
                            <h2>Your AI trading partner</h2>
                            <p>Live market statistics and risk controls from your active Deriv account.</p>
                        </div>
                        <div className='mp-page-heading__actions'>
                            <span className={`mp-engine-state ${engine.status}`}>
                                <i /> {engine.status.replace('-', ' ')}
                            </span>
                            <button className='mp-button mp-button--outline' onClick={() => setActivePanel('settings')}>
                                <ShieldCheck size={15} /> Risk settings
                            </button>
                        </div>
                    </div>

                    {notice && (
                        <div className='mp-notice' role='status'>
                            <AlertTriangle size={15} />
                            <span>{notice}</span>
                            <button onClick={() => setNotice('')} aria-label='Dismiss message'>×</button>
                        </div>
                    )}

                    {!engine.account.authorized && (
                        <div className='mp-connect-banner'>
                            <Radio size={18} />
                            <div>
                                <strong>Connect your Deriv demo or real account</strong>
                                <span>Money Print uses the account already active in Mark Syn Trader. Switch accounts in the app header.</span>
                            </div>
                        </div>
                    )}

                    <section className='mp-stat-grid' aria-label='Account overview'>
                        <StatCard icon={<Wallet />} label='Account balance' value={engine.account.balance == null ? '—' : money(engine.account.balance, engine.account.currency)} detail={engine.account.authorized ? connectionCopy : 'Awaiting account'} tone='teal' />
                        <StatCard icon={<TrendingUp />} label='Session P/L' value={money(engine.session.pnl, engine.account.currency)} detail={`${engine.session.wins} wins · ${engine.session.losses} losses`} tone={engine.session.pnl >= 0 ? 'green' : 'red'} />
                        <StatCard icon={<BarChart3 />} label='Journal win rate' value={winRate == null ? '—' : `${winRate.toFixed(1)}%`} detail={`${wins + losses} settled trades saved locally`} tone='purple' />
                        <StatCard icon={<Clock3 />} label='East Africa time' value={clock.time} detail={prefs.mode === 'sessions' ? sessionTitle : 'Current time · Africa/Nairobi'} tone='blue' />
                    </section>

                    {activePanel === 'settings' ? (
                        <SettingsPanel
                            settings={settings}
                            prefs={prefs}
                            accountIsReal={accountIsReal}
                            liveAcknowledged={liveAcknowledged}
                            stake={effectiveStakeDisplay}
                            currency={engine.account.currency}
                            riskLockUntil={riskLockActive ? riskLockUntil : null}
                            onSetting={patchSetting}
                            onPref={patchPrefs}
                            onLiveAcknowledged={setLiveAcknowledged}
                        />
                    ) : activePanel === 'reports' ? (
                        <ReportPanel
                            trades={journal}
                            currency={engine.account.currency}
                            onExport={exportCsv}
                            onPrint={() => window.print()}
                        />
                    ) : (
                        <>
                            <div className='mp-main-grid'>
                                <section className='mp-card mp-settings-card'>
                                    <CardHeading icon={<ShieldCheck />} title='Trade settings' meta='RISK GUARDIAN' />
                                    <div className='mp-form-grid'>
                                        <label className='mp-field'>
                                            <span>Strategy engine</span>
                                            <select disabled={riskLockActive || engine.inputsDisabled} value={prefs.strategyMode} onChange={event => patchPrefs('strategyMode', event.target.value as AutoLabMode)}>
                                                {AUTO_LAB_MODES.map(mode => <option key={mode} value={mode}>{strategyLabel(mode)}</option>)}
                                            </select>
                                        </label>
                                        <label className='mp-field'>
                                            <span>Market universe</span>
                                            <select disabled={riskLockActive || engine.inputsDisabled} value={settings.marketSelection} onChange={event => patchSetting('marketSelection', event.target.value)}>
                                                <option value='ALL'>All available synthetic markets</option>
                                                {engine.markets.map(market => <option key={market.symbol} value={market.symbol}>{market.label}</option>)}
                                            </select>
                                        </label>
                                        <label className='mp-field'>
                                            <span>Trade type</span>
                                            <select disabled={riskLockActive || engine.inputsDisabled} value={settings.contractType} onChange={event => patchSetting('contractType', event.target.value as AutoLabSettings['contractType'])}>
                                                <option value='AUTO'>Scan all enabled types</option>
                                                {AUTO_LAB_CONTRACT_TYPES.map(type => <option key={type} value={type}>{CONTRACT_LABELS[type]}</option>)}
                                            </select>
                                        </label>
                                        <label className='mp-field'>
                                            <span>Signal window</span>
                                            <select disabled={riskLockActive || engine.inputsDisabled} value={settings.ticksWindow} onChange={event => patchSetting('ticksWindow', Number(event.target.value))}>
                                                {[5, 12, 15, 20, 50, 100, 500].map(count => <option key={count} value={count}>{count} ticks</option>)}
                                            </select>
                                        </label>
                                    </div>
                                    <div className='mp-settings-summary'>
                                        <div><span>Next stake</span><strong>{money(effectiveStakeDisplay, engine.account.currency)}</strong></div>
                                        <div><span>Take profit</span><strong className='is-green'>{money(settings.takeProfit, engine.account.currency)}</strong></div>
                                        <div><span>Stop loss</span><strong className='is-red'>−{money(settings.stopLoss, engine.account.currency)}</strong></div>
                                    </div>
                                    <div className='mp-check-row'>
                                        <label className='mp-switch'>
                                            <input type='checkbox' disabled={riskLockActive || engine.inputsDisabled} checked={prefs.autoStake} onChange={event => patchPrefs('autoStake', event.target.checked)} />
                                            <span className='mp-switch__track' />
                                            <b>Auto stake from account size</b>
                                        </label>
                                        <span>{prefs.autoStake ? `${prefs.riskPercent}% risk · capped at ${money(prefs.maxStake, engine.account.currency)}` : 'Fixed base stake'}</span>
                                    </div>
                                    {prefs.autoStake && autoStake < MIN_DERIV_STAKE && (
                                        <div className='mp-risk-warning mp-risk-warning--action'>
                                            <AlertTriangle size={15} />
                                            <p>
                                                Auto stake is {money(autoStake, engine.account.currency)}, below the {money(MIN_DERIV_STAKE, engine.account.currency)} minimum.
                                                On a small demo balance, use the fixed base stake instead of silently exceeding the selected risk cap.
                                            </p>
                                            <button type='button' disabled={riskLockActive} onClick={() => {
                                                patchPrefs('autoStake', false);
                                                setNotice(`Auto stake disabled. The fixed base stake is ${money(settings.stake, engine.account.currency)}; review risk settings before starting.`);
                                            }}>Use fixed stake</button>
                                        </div>
                                    )}
                                    <div className='mp-risk-caption'><ShieldAlert size={13} /> Capped martingale is optional, off by default, and limited to 2 recovery steps.</div>
                                    <button className='mp-link-button' onClick={() => setActivePanel('settings')}>Open full risk settings <ArrowUpRight size={14} /></button>
                                </section>

                                <section className='mp-card mp-signal-card'>
                                    <CardHeading icon={<BrainCircuit />} title='Neural link signal' meta='LIVE MARKET SCAN' />
                                    <div className='mp-signal-card__top'>
                                        <div>
                                            <span className='mp-kicker'>CURRENT SETUP</span>
                                            <h3>{engine.currentSignal.label}</h3>
                                            <p>{engine.currentSignal.detail}</p>
                                        </div>
                                        <div className='mp-score'>
                                            <strong>{engine.currentSignal.confidence == null ? '—' : `${Math.round(engine.currentSignal.confidence)}`}</strong>
                                            <span>setup score<br />not win odds</span>
                                        </div>
                                    </div>
                                    <div className='mp-signal-market'><span>Best market</span><strong>{engine.currentSignal.market || 'Waiting for a qualified setup'}</strong></div>
                                    <div className='mp-barrier-note'>
                                        <Lightbulb size={14} />
                                        Over/Under can scan digit barriers 0–9. Rise/Fall uses consecutive price direction (only-up / only-down streaks).
                                    </div>
                                    <div className='mp-digit-distribution'>
                                        <div className='mp-digit-distribution__title'><span>Observed last-digit distribution</span><small>{settings.ticksWindow}-tick window · actual feed</small></div>
                                        <div className='mp-digit-bars'>
                                            {engine.digitStats.map(item => (
                                                <div className='mp-digit-bar' key={item.digit} title={`Digit ${item.digit}: ${item.percent.toFixed(1)}%`}>
                                                    <div className='mp-digit-bar__track'><i style={{ height: `${Math.min(100, Math.max(2, item.percent * 5))}%` }} /></div>
                                                    <span>{item.digit}</span>
                                                </div>
                                            ))}
                                            {!engine.digitStats.length && <span className='mp-muted'>Live distribution appears after data arrives.</span>}
                                        </div>
                                    </div>
                                </section>

                                <section className='mp-card mp-run-card'>
                                    <CardHeading icon={<Radio />} title='Account & execution' meta={accountIsReal ? 'LIVE TRADING' : 'DEMO FIRST'} />
                                    <div className='mp-run-card__account'>
                                        <span className={`mp-account-icon ${accountIsDemo ? 'is-demo' : accountIsReal ? 'is-real' : ''}`}><Wallet size={20} /></span>
                                        <div><strong>{connectionCopy}</strong><span>{engine.account.loginId || 'No active login ID'}</span></div>
                                    </div>
                                    {accountIsReal && (
                                        <label className='mp-live-confirm'>
                                            <input type='checkbox' checked={liveAcknowledged} onChange={event => setLiveAcknowledged(event.target.checked)} />
                                            <span>I understand these trades use real funds and losses are possible.</span>
                                        </label>
                                    )}
                                    {prefs.scheduledSessions && (
                                        <div className='mp-schedule-status'>
                                            <CalendarClock size={15} />
                                            <span>{sessionWindow ? `Scheduled window active · ${sessionWindow.label} EAT` : 'Waiting for the next enabled window · EAT'}</span>
                                        </div>
                                    )}
                                    <div className='mp-run-actions'>
                                        {['running', 'scanning', 'connecting'].includes(engine.status) ? (
                                            <>
                                                <button className='mp-button mp-button--pause' onClick={engine.onPause}><Pause size={15} /> Pause</button>
                                                <button className='mp-button mp-button--stop' onClick={() => {
                                                    pendingMatchStartRef.current = null;
                                                    setAutoMatchArmed(false);
                                                    scheduledRunRef.current = false;
                                                    engine.onStop();
                                                }}><CircleStop size={15} /> Stop</button>
                                            </>
                                        ) : (
                                            <button className='mp-button mp-button--start' onClick={runButton} disabled={!canStart || prefs.scheduledSessions}>
                                                <Play size={16} /> {prefs.scheduledSessions ? 'Schedule enabled' : 'Start safe scan'}
                                            </button>
                                        )}
                                    </div>
                                    <p className='mp-engine-message'>{engine.message}</p>
                                    <div className='mp-small-disclaimer'>Keep this page open during automation. Open contracts settle through Deriv even after a manual stop.</div>
                                </section>
                            </div>

                            <section className='mp-card mp-modes-section'>
                                <CardHeading icon={<Zap />} title='Trade modes' meta='ALL MODES SHARE THE SAME RISK LIMITS' />
                                <div className='mp-mode-grid'>
                                    {MODE_CARDS.map(card => (
                                        <button
                                            className={`mp-mode-card ${prefs.mode === card.id ? 'selected' : ''} ${card.id === 'flip' && !accountIsDemo ? 'restricted' : ''}`}
                                            key={card.id}
                                            onClick={() => selectMode(card.id)}
                                            type='button'
                                            disabled={riskLockActive || engine.inputsDisabled}
                                        >
                                            <span className='mp-mode-card__icon'>{card.icon}</span>
                                            <strong>{card.title}</strong>
                                            <small>{card.note}</small>
                                            {card.id === 'flip' && <em>{accountIsDemo ? 'DEMO ONLY' : 'DEMO REQUIRED'}</em>}
                                        </button>
                                    ))}
                                </div>
                                <ModeDetails
                                    mode={prefs.mode}
                                    prefs={prefs}
                                    settings={settings}
                                    scheduledSessions={prefs.scheduledSessions}
                                    onPref={patchPrefs}
                                    onSetting={patchSetting}
                                    tradingLocked={riskLockActive}
                                />
                            </section>

                            {prefs.mode === 'challenge' && (
                                <MoneyPrintNeuralLink
                                    challengeBrief={prefs.challenge}
                                    onChallengeBriefChange={value => patchPrefs('challenge', value.slice(0, 500))}
                                    onAnalyze={analyzeChallenge}
                                    analysisBusy={false}
                                    report={neuralReport}
                                    onDownloadImage={() => {
                                        if (!neuralReport) return;
                                        try {
                                            downloadMoneyPrintReportImage(neuralReport, engine.account.currency);
                                        } catch (error) {
                                            setNotice(error instanceof Error ? error.message : 'Could not create the report image.');
                                        }
                                    }}
                                    matches={matchRoutes}
                                    selectedMatchKey={selectedMatchKey}
                                    onSelectMatch={(route: MatchRoute) => setSelectedMatchKey(getMatchRouteKey(route))}
                                    onAutoMatch={toggleAutoMatch}
                                    autoMatchEnabled={autoMatchArmed}
                                    canAutoMatch={canAutoMatch}
                                    autoMatchBlockReason={autoMatchBlockReason}
                                    scheduledSessions={prefs.scheduledSessions}
                                    onScheduledSessionsChange={onScheduleSessionsChange}
                                    lockUntil={riskLockActive ? riskLockUntil : null}
                                    currency={engine.account.currency}
                                    status={engine.status}
                                />
                            )}

                            <div className='mp-lower-grid'>
                                <section className='mp-card mp-markets-card'>
                                    <CardHeading icon={<Activity />} title='Market scanner' meta={`${engine.markets.length} AVAILABLE`} />
                                    <div className='mp-table-wrap'>
                                        <table className='mp-table'>
                                            <thead><tr><th>Market</th><th>Last digit</th><th>Setup</th><th>Score</th></tr></thead>
                                            <tbody>
                                                {engine.markets.slice(0, 12).map(market => (
                                                    <tr key={market.symbol}>
                                                        <td><strong>{market.label}</strong><small>{market.symbol}</small></td>
                                                        <td>{market.digit ?? '—'}</td>
                                                        <td><span className={`mp-signal-pill ${market.score == null ? 'neutral' : 'active'}`}>{market.signal}</span></td>
                                                        <td>{market.score == null ? '—' : Math.round(market.score)}</td>
                                                    </tr>
                                                ))}
                                                {!engine.markets.length && <tr><td colSpan={4} className='mp-empty-row'>Markets load from the authorized Deriv session.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section className='mp-card mp-performance-card'>
                                    <CardHeading icon={<BarChart3 />} title='Session performance' meta='SETTLED RESULTS' />
                                    <div className='mp-performance-card__pnl'>
                                        <span>Realized P/L · current run</span>
                                        <strong className={engine.session.pnl >= 0 ? 'is-green' : 'is-red'}>{money(engine.session.pnl, engine.account.currency)}</strong>
                                    </div>
                                    <div className='mp-performance-card__stats'>
                                        <div><span>Contracts</span><b>{engine.session.trades}</b></div>
                                        <div><span>Open</span><b>{openCount}</b></div>
                                        <div><span>Top journal market</span><b>{topMarket?.[0] ?? '—'}</b></div>
                                    </div>
                                    <div className='mp-insight-note'><CheckCircle2 size={14} /> Realized results come from Deriv settlement messages. Open contracts are excluded from profit totals.</div>
                                </section>

                                <section className='mp-card mp-admin-card'>
                                    <CardHeading icon={<ShieldAlert />} title='Admin insights' meta='ACCOUNT ONLY' />
                                    <div className='mp-admin-card__stats'>
                                        <div><span>Trades in local journal</span><strong>{journal.length}</strong></div>
                                        <div><span>Top market by recorded P/L</span><strong>{topMarket?.[0] ?? 'Not enough data'}</strong></div>
                                        <div><span>Best recorded market P/L</span><strong>{topMarket ? money(topMarket[1], engine.account.currency) : '—'}</strong></div>
                                    </div>
                                    <p>Connected-user counts and cross-user rankings need a secured admin service; this page does not collect or invent other users’ data.</p>
                                </section>
                            </div>

                            <ReportPanel
                                trades={latestTrades}
                                currency={engine.account.currency}
                                onExport={exportCsv}
                                onPrint={() => window.print()}
                                compact
                            />
                        </>
                    )}

                    <footer className='mp-footer'>
                        <span><ShieldCheck size={13} /> Risk Guardian active</span>
                        <span><Radio size={13} /> {engine.markets.length} live synthetic markets discovered</span>
                        <span>Money Print · informational statistics, not financial advice</span>
                    </footer>
                </main>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; detail: string; tone: string }> = ({ icon, label, value, detail, tone }) => (
    <div className={`mp-stat-card ${tone}`}>
        <span className='mp-stat-card__icon'>{icon}</span>
        <div className='mp-stat-card__copy'>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
        </div>
        <span className='mp-stat-card__spark'><i /><i /><i /><i /><i /><i /></span>
    </div>
);

const CardHeading: React.FC<{ icon: React.ReactNode; title: string; meta?: string }> = ({ icon, title, meta }) => (
    <div className='mp-card-heading'>
        <div className='mp-card-heading__title'><span>{icon}</span><strong>{title}</strong></div>
        {meta && <small>{meta}</small>}
    </div>
);

const strategyLabel = (mode: AutoLabMode) => {
    const labels: Record<AutoLabMode, string> = {
        Multimarket: 'Multimarket · all supported strategies',
        'RC Even/Odd': 'Even / Odd cycle',
        'RC Over4/Under5': 'Over / Under · auto barrier',
        '%Even/Odd': 'Even / Odd distribution',
        'Matches/Differs': 'Matches / Differs',
        'Rise/Fall': 'Rise / Fall · only-up / only-down streaks',
    };
    return labels[mode];
};

const SettingsPanel: React.FC<{
    settings: AutoLabSettings;
    prefs: MoneyPrintPrefs;
    accountIsReal: boolean;
    liveAcknowledged: boolean;
    stake: number;
    currency: string;
    riskLockUntil: number | null;
    onSetting: <K extends keyof AutoLabSettings>(key: K, value: AutoLabSettings[K]) => void;
    onPref: <K extends keyof MoneyPrintPrefs>(key: K, value: MoneyPrintPrefs[K]) => void;
    onLiveAcknowledged: (value: boolean) => void;
}> = ({ settings, prefs, accountIsReal, liveAcknowledged, stake, currency, riskLockUntil, onSetting, onPref, onLiveAcknowledged }) => (
    <section className='mp-settings-layout'>
        <div className='mp-card mp-settings-form'>
            <CardHeading icon={<ShieldCheck />} title='Trade settings' meta='SAVED IN THIS BROWSER' />
            {riskLockUntil != null && (
                <div className='mp-risk-lock-banner' role='alert'>
                    <strong>DO NOT TRADE</strong>
                    <span>Trade settings and new entries are locked until {new Date(riskLockUntil).toLocaleString()}. Open contracts will settle normally.</span>
                </div>
            )}
            <div className='mp-form-grid'>
                <label className='mp-field'>
                    <span>Base stake {prefs.autoStake ? '(calculated)' : ''}</span>
                    <input type='number' min={MIN_DERIV_STAKE} step='0.01' disabled={riskLockUntil != null || prefs.autoStake} value={prefs.autoStake ? fromUsd(stake).toFixed(2) : fromUsd(settings.stake).toFixed(2)} onChange={event => onSetting('stake', Math.max(MIN_DERIV_STAKE, toUsd(Number(event.target.value) || MIN_DERIV_STAKE)))} />
                </label>
                <label className='mp-field'>
                    <span>Risk per trade · % of balance</span>
                    <input type='number' min='0.1' max='2' step='0.1' disabled={riskLockUntil != null || !prefs.autoStake} value={prefs.riskPercent} onChange={event => onPref('riskPercent', Math.min(2, Math.max(0.1, Number(event.target.value) || 0.1)))} />
                </label>
                <label className='mp-field'>
                    <span>Maximum stake</span>
                    <input type='number' min={MIN_DERIV_STAKE} step='0.01' disabled={riskLockUntil != null} value={fromUsd(prefs.maxStake).toFixed(2)} onChange={event => onPref('maxStake', Math.max(MIN_DERIV_STAKE, toUsd(Number(event.target.value) || MIN_DERIV_STAKE)))} />
                </label>
                <label className='mp-field'>
                    <span>Take profit · session</span>
                    <input type='number' min='0.1' step='0.1' disabled={riskLockUntil != null} value={fromUsd(settings.takeProfit).toFixed(2)} onChange={event => onSetting('takeProfit', Math.max(0.1, toUsd(Number(event.target.value) || 0.1)))} />
                </label>
                <label className='mp-field'>
                    <span>Stop loss · session</span>
                    <input type='number' min='0.1' step='0.1' disabled={riskLockUntil != null} value={fromUsd(settings.stopLoss).toFixed(2)} onChange={event => onSetting('stopLoss', Math.max(0.1, toUsd(Number(event.target.value) || 0.1)))} />
                </label>
                <label className='mp-field'>
                    <span>Maximum recovery steps</span>
                    <select disabled={riskLockUntil != null || !prefs.martingaleEnabled} value={Math.min(2, settings.maxMartingaleLevel)} onChange={event => onSetting('maxMartingaleLevel', Number(event.target.value))}>
                        <option value={1}>1 step</option><option value={2}>2 steps maximum</option>
                    </select>
                </label>
                <label className='mp-field'>
                    <span>Martingale multiplier</span>
                    <select disabled={riskLockUntil != null || !prefs.martingaleEnabled} value={settings.multiplier} onChange={event => onSetting('multiplier', Number(event.target.value))}>
                        <option value={1.5}>1.5×</option><option value={1.8}>1.8×</option><option value={2}>2×</option>
                    </select>
                </label>
                <label className='mp-field'>
                    <span>Signal threshold</span>
                    <input type='number' min='50' max='100' step='1' disabled={riskLockUntil != null} value={settings.thresholdPercent} onChange={event => onSetting('thresholdPercent', Math.min(100, Math.max(50, Number(event.target.value) || 50)))} />
                </label>
                <label className='mp-field'>
                    <span>Direction streak</span>
                    <select disabled={riskLockUntil != null} value={settings.requiredStreak} onChange={event => onSetting('requiredStreak', Number(event.target.value))}>
                        {[2, 3, 4, 5].map(count => <option key={count} value={count}>{count} consecutive ticks</option>)}
                    </select>
                </label>
                <label className='mp-field'>
                    <span>Contract duration</span>
                    <select disabled={riskLockUntil != null} value={settings.duration} onChange={event => onSetting('duration', Number(event.target.value))}>
                        {[1, 2, 3, 5, 10].map(count => <option key={count} value={count}>{count} tick{count === 1 ? '' : 's'}</option>)}
                    </select>
                </label>
            </div>
            <div className='mp-option-stack'>
                <label className='mp-switch'>
                    <input type='checkbox' disabled={riskLockUntil != null} checked={prefs.autoStake} onChange={event => onPref('autoStake', event.target.checked)} />
                    <span className='mp-switch__track' />
                    <b>Auto stake according to account size</b>
                </label>
                <label className='mp-switch'>
                    <input type='checkbox' disabled={riskLockUntil != null} checked={prefs.martingaleEnabled} onChange={event => onPref('martingaleEnabled', event.target.checked)} />
                    <span className='mp-switch__track' />
                    <b>Enable capped martingale · 2 steps maximum</b>
                </label>
                <label className='mp-switch'>
                    <input type='checkbox' disabled={riskLockUntil != null} checked={settings.autoBarrier} onChange={event => onSetting('autoBarrier', event.target.checked)} />
                    <span className='mp-switch__track' />
                    <b>Scan Over 0–9 and Under 0–9 barriers</b>
                </label>
            </div>
            {prefs.autoStake && stake < MIN_DERIV_STAKE && (
                <div className='mp-risk-warning mp-risk-warning--action'>
                    <AlertTriangle size={15} />
                    <p>
                        The selected balance-risk limit calculates to less than {money(MIN_DERIV_STAKE, currency)}.
                        Money Print will not raise it to the minimum automatically.
                    </p>
                    <button type='button' disabled={riskLockUntil != null} onClick={() => onPref('autoStake', false)}>Use fixed base stake</button>
                </div>
            )}
            {!settings.autoBarrier && (
                <div className='mp-digit-picks'>
                    <span>Selected digit barrier</span>
                    {Array.from({ length: 10 }, (_, digit) => (
                        <button type='button' key={digit} className={settings.barrier === digit ? 'active' : ''} disabled={riskLockUntil != null} onClick={() => onSetting('barrier', digit)}>{digit}</button>
                    ))}
                </div>
            )}
            <div className='mp-settings-footer'>
                <span>Stake calculated now: <strong>{money(stake, currency)}</strong></span>
                <span>Values are in account currency; display may be USD or KSH.</span>
            </div>
        </div>
        <div className='mp-card mp-protection-card'>
            <CardHeading icon={<ShieldAlert />} title='Auto stop & recovery' meta='HARD LIMITS' />
            <div className='mp-protection-item'><span className='mp-protection-item__icon'><Target /></span><div><strong>Take-profit stop</strong><small>Stops opening trades at your session target.</small></div><b>{money(settings.takeProfit, currency)}</b></div>
            <div className='mp-protection-item'><span className='mp-protection-item__icon is-red'><ShieldAlert /></span><div><strong>Session loss limit</strong><small>Stops opening trades at your loss limit.</small></div><b>−{money(settings.stopLoss, currency)}</b></div>
            <div className='mp-protection-item'><span className='mp-protection-item__icon is-purple'><Activity /></span><div><strong>Consecutive loss recovery</strong><small>Optional stake increase, strictly capped.</small></div><b>{prefs.martingaleEnabled ? `${Math.min(2, settings.maxMartingaleLevel)} steps` : 'Off'}</b></div>
            <div className='mp-risk-warning'><AlertTriangle size={16} /><p>Martingale does not recover losses reliably and can increase losses quickly. It starts off, is limited to two steps, and never bypasses the stop-loss.</p></div>
            {accountIsReal && (
                <label className='mp-live-confirm mp-live-confirm--settings'>
                    <input type='checkbox' checked={liveAcknowledged} onChange={event => onLiveAcknowledged(event.target.checked)} />
                    <span>Confirm that you want Money Print to place trades on the currently active real account.</span>
                </label>
            )}
            <div className='mp-risk-footnote'>Stopping automation prevents new entries; any open contract still settles normally through Deriv.</div>
        </div>
    </section>
);

const ModeDetails: React.FC<{
    mode: MoneyMode;
    prefs: MoneyPrintPrefs;
    settings: AutoLabSettings;
    scheduledSessions: boolean;
    tradingLocked: boolean;
    onPref: <K extends keyof MoneyPrintPrefs>(key: K, value: MoneyPrintPrefs[K]) => void;
    onSetting: <K extends keyof AutoLabSettings>(key: K, value: AutoLabSettings[K]) => void;
}> = ({ mode, prefs, settings, scheduledSessions, tradingLocked, onPref, onSetting }) => {
    if (mode === 'sessions') {
        return (
            <div className='mp-mode-detail'>
                <div className='mp-mode-detail__intro'><strong>Scheduled sessions · East Africa Time</strong><span>When enabled, the scanner starts inside an open window and stops at the window end or a risk limit. The browser must stay open.</span></div>
                <div className='mp-session-times'>{SESSION_WINDOWS.map(window => <span key={window.id} className={getEastAfricaTime().minutes >= window.start && getEastAfricaTime().minutes < window.end ? 'active' : ''}><Clock3 size={13} /> {window.label}</span>)}</div>
                <label className='mp-switch'>
                    <input type='checkbox' disabled={tradingLocked} checked={scheduledSessions} onChange={event => onPref('scheduledSessions', event.target.checked)} />
                    <span className='mp-switch__track' /><b>Enable automatic session start / stop</b>
                </label>
            </div>
        );
    }
    if (mode === 'challenge') {
        return (
            <div className='mp-mode-detail'>
                <div className='mp-mode-detail__intro'>
                    <strong>Challenge mode · local Neural Link review</strong>
                    <span>The analysis uses this account’s settled journal and authenticated tick history in the browser. It does not send account data to an external AI service or promise a profitable route.</span>
                </div>
            </div>
        );
    }
    if (mode === 'growth' || mode === 'accumulation') {
        return (
            <div className='mp-mode-detail mp-mode-detail--form'>
                <label className='mp-field'><span>Target balance</span><input type='number' min='1' step='1' value={fromUsd(prefs.goalBalance).toFixed(2)} onChange={event => onPref('goalBalance', Math.max(1, toUsd(Number(event.target.value) || 1)))} /></label>
                <label className='mp-field'><span>Planning days</span><input type='number' min='1' max='365' step='1' value={prefs.days} onChange={event => onPref('days', Math.min(365, Math.max(1, Number(event.target.value) || 1)))} /></label>
                <span className='mp-mode-detail__caution'>Planning goal only. The engine still stops at your session TP/SL and does not increase risk to catch up.</span>
            </div>
        );
    }
    if (mode === 'earnings') {
        return (
            <div className='mp-mode-detail mp-mode-detail--form'>
                <label className='mp-field'><span>Hourly profit target</span><input type='number' min='0.1' step='0.1' value={fromUsd(prefs.hourlyTarget).toFixed(2)} onChange={event => onPref('hourlyTarget', Math.max(0.1, toUsd(Number(event.target.value) || 0.1)))} /></label>
                <label className='mp-field'><span>Current hard TP</span><input type='number' min='0.1' step='0.1' value={fromUsd(settings.takeProfit).toFixed(2)} onChange={event => onSetting('takeProfit', Math.max(0.1, toUsd(Number(event.target.value) || 0.1)))} /></label>
                <span className='mp-mode-detail__caution'>The hard TP/SL are authoritative. Hourly schedules need this page open to run.</span>
            </div>
        );
    }
    return (
        <div className='mp-mode-detail mp-mode-detail--flip'>
            <Zap size={17} />
            <div><strong>Demo-only, bounded experiment.</strong><span>Uses the same signal engine, stake cap and stop-loss. Fast balance growth is not promised; real-account execution is blocked.</span></div>
        </div>
    );
};

const ReportPanel: React.FC<{
    trades: AutoLabTrade[];
    currency: string;
    onExport: () => void;
    onPrint: () => void;
    compact?: boolean;
}> = ({ trades, currency, onExport, onPrint, compact = false }) => (
    <section className={`mp-card mp-report-card ${compact ? 'is-compact' : ''}`}>
        <div className='mp-report-heading'>
            <CardHeading icon={<BarChart3 />} title={compact ? 'Recent trades' : 'Printable trade report'} meta={`${trades.length} RECORDS`} />
            <div className='mp-report-actions'>
                <button className='mp-button mp-button--outline' onClick={onExport}><Download size={14} /> CSV</button>
                <button className='mp-button mp-button--outline' onClick={onPrint}><Printer size={14} /> Print</button>
            </div>
        </div>
        <div className='mp-table-wrap'>
            <table className='mp-table mp-report-table'>
                <thead><tr><th>Contract</th><th>Time</th><th>Market</th><th>Type</th><th>Stake</th><th>Net P/L</th><th>Result</th></tr></thead>
                <tbody>
                    {trades.slice(0, compact ? 8 : 500).map(trade => (
                        <tr key={trade.id}>
                            <td>#{trade.id}</td><td>{trade.time}</td><td>{trade.market}</td>
                            <td>{CONTRACT_LABELS[trade.contract as AutoLabContractType] ?? trade.contract}</td>
                            <td>{money(trade.stake, currency)}</td>
                            <td className={trade.status === 'OPEN' ? '' : trade.profit >= 0 ? 'is-green' : 'is-red'}>{trade.status === 'OPEN' ? 'Pending' : money(trade.profit, currency)}</td>
                            <td><span className={`mp-result ${trade.status.toLowerCase()}`}>{trade.status}</span></td>
                        </tr>
                    ))}
                    {!trades.length && <tr><td colSpan={7} className='mp-empty-row'>Settled trades will appear here after the first run.</td></tr>}
                </tbody>
            </table>
        </div>
        {!compact && <p className='mp-report-footnote'>This report contains this browser’s locally saved records for the currently active account. It does not include unsaved trades from other devices.</p>}
    </section>
);

const DTrader: React.FC = () => (
    <MoneyPrintErrorBoundary>
        <DTraderContent />
    </MoneyPrintErrorBoundary>
);

export default DTrader;
