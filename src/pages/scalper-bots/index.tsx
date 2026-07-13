// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { applyCommission } from '@/utils/commission';
import manifest from '../../../public/bots/scalpers/manifest.json';
import './scalper-bots.scss';

/* ─── Types ─── */
type TScalperBot = {
    key: string; name: string;
    category: 'Even/Odd' | 'Over/Under';
    contractType: string;
    prediction: number | null;
    multiple: boolean;
    xmlFile: string;
};

type TxRecord = {
    id: number; time: string; market: string;
    type: string; stake: number; barrier: number | null;
    result: 'won' | 'lost' | 'open';
    profit: number; exitDigit: number | null;
};

type RiskManagerConfig = {
    inject: boolean;
    active: boolean;
    onLose: boolean;
    activateLimit: number;
    deactivateLimit: number;
    multiplier: number;
    overrideStake: number;
};

/* Strategy Logic — condition-based entry engine (mirrors the reference "OR Group" UI) */

const DIGITS_IS_OPTIONS = [
    'MATCHES', 'DIFFERS', 'OVER', 'UNDER', 'EVEN', 'ODD',
    'HIGH TICK', 'LOW TICK', 'RISE EQUAL', 'FALL EQUAL',
    'RISE', 'FALL', 'RISE RESET', 'FALL RESET',
    'ASIAN UP', 'ASIAN DOWN', 'ONLY UPS', 'ONLY DOWNS',
    'HIGHER', 'LOWER',
] as const;
type DigitsIsType = typeof DIGITS_IS_OPTIONS[number];

const IF_LAST_OPTIONS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];

/** A single LDP sub-condition (one row in the UI). */
type StrategyCondition = {
    id: string;
    algorithm: 'LDP'; // Last-Digit-Pattern
    strict: boolean;
    ifLast: number;
    digitsIs: DigitsIsType;
    digitValue: number; // barrier for OVER/UNDER/MATCHES/DIFFERS (0-9)
    recoveryLimit: number;
};

/** One OR group — all its conditions must pass (AND within the group). */
type StrategyOrGroup = {
    id: string;
    conditions: StrategyCondition[]; // [0]=CONDITION, [1+]=AND CONDITIONS
};

type StrategyLogicConfig = {
    globalShared: boolean;
    active: boolean;
    groups: StrategyOrGroup[]; // any group passing triggers entry (OR across groups)
};

type BotConfig = {
    market: string;
    markets: string[];
    useMarketSwitch: boolean;
    switchOnLosses: number;
    duration: number;
    stake: number;
    martingale: number;
    stopOnLoss: boolean;
    consecutiveLossLimit: number;
    tpGuard: boolean;
    takeProfit: number;
    stopLoss: number;
    riskManager: RiskManagerConfig;
    strategyLogic: StrategyLogicConfig;
};

const DEFAULT_RM: RiskManagerConfig = {
    inject: false, active: true, onLose: true,
    activateLimit: 1, deactivateLimit: 100,
    multiplier: 2, overrideStake: 20,
};

let sbCondSeq = 0;
const newCondition = (bot: TScalperBot): StrategyCondition => ({
    id: `cond_${++sbCondSeq}`,
    algorithm: 'LDP',
    strict: true,
    ifLast: 3,
    digitsIs: bot.contractType === 'DIGITEVEN' ? 'ODD' : bot.contractType === 'DIGITODD' ? 'EVEN' : 'ODD',
    digitValue: 5,
    recoveryLimit: 1,
});

let sbGroupSeq = 0;
const newOrGroup = (bot: TScalperBot): StrategyOrGroup => ({
    id: `grp_${++sbGroupSeq}`,
    conditions: [newCondition(bot)],
});

const DEFAULT_CONFIG = (bot: TScalperBot): BotConfig => ({
    market: '1HZ10V',
    markets: ['1HZ50V', '1HZ100V', '1HZ75V'],
    useMarketSwitch: false,
    switchOnLosses: 2,
    duration: 1,
    stake: 0.35,
    martingale: 2,
    stopOnLoss: bot.multiple,
    consecutiveLossLimit: 4,
    tpGuard: bot.multiple,
    takeProfit: 100,
    stopLoss: bot.contractType === 'DIGITODD' ? 500 : 300,
    riskManager: { ...DEFAULT_RM },
    strategyLogic: {
        globalShared: false,
        active: bot.category === 'Even/Odd',
        groups: bot.category === 'Even/Odd' ? [newOrGroup(bot)] : [],
    },
});

const ALL_MARKETS = [
    { label: 'V10 (1s)',  value: '1HZ10V'  },
    { label: 'V25 (1s)',  value: '1HZ25V'  },
    { label: 'V50 (1s)',  value: '1HZ50V'  },
    { label: 'V75 (1s)',  value: '1HZ75V'  },
    { label: 'V100 (1s)', value: '1HZ100V' },
    { label: 'V10',       value: 'R_10'    },
    { label: 'V25',       value: 'R_25'    },
    { label: 'V50',       value: 'R_50'    },
    { label: 'V75',       value: 'R_75'    },
    { label: 'V100',      value: 'R_100'   },
    { label: 'Jump 10',   value: 'JD10'    },
    { label: 'Jump 25',   value: 'JD25'    },
    { label: 'Jump 50',   value: 'JD50'    },
    { label: 'Jump 75',   value: 'JD75'    },
    { label: 'Jump 100',  value: 'JD100'   },
];

const SCALPER_BOTS: TScalperBot[] = manifest as TScalperBot[];
const CATEGORIES = ['All', 'Even/Odd', 'Over/Under'];

/* ─── Hacker scan messages (shown during market analysis) ─── */
const HACK_SCAN_MSGS = [
    'BYPASSING FIREWALL...',
    'BUFFER_OVERFLOW_CHECK: PASS',
    'DDOS_PROTECTION: BYPASSED',
    'ENCRYPTING RSA_2048_KEYS',
    'INJECTING_RECOVERY_PROTOCOL',
    'EXTRACTING MARKET_DATA_PACKET',
    'ANALYZING_NEURAL_PATTERN',
    'SYNC_PROTOCOL: ACTIVE',
    'QUANTUM_SHIELD: ENABLED',
    'MARKET_FEED_INTEGRITY: OK',
    'SCANNING_VOLATILITY_INDEX',
    'SIGNAL_PROCESSOR: ONLINE',
    'FIREWALL_BYPASS: SUCCESS',
    'PROXY_CHAIN: ANONYMIZED',
    'DEEP_SCAN: RUNNING...',
];

/* ─── Entry signal detection ─── */
function checkEntry(digits: number[], contractType: string, barrier: number | null): boolean {
    if (digits.length < 5) return false;
    const recent = digits.slice(0, 10);

    switch (contractType) {
        case 'DIGITEVEN': {
            // contrarian: ≥3 consecutive ODD → bet EVEN
            let streak = 0;
            for (const d of recent) { if (d % 2 !== 0) streak++; else break; }
            return streak >= 3;
        }
        case 'DIGITODD': {
            // contrarian: ≥3 consecutive EVEN → bet ODD
            let streak = 0;
            for (const d of recent) { if (d % 2 === 0) streak++; else break; }
            return streak >= 3;
        }
        case 'DIGITOVER': {
            if (barrier === null) return true;
            // reversal: ≥2 consecutive digits ≤ barrier → bet OVER
            let streak = 0;
            for (const d of recent) { if (d <= barrier) streak++; else break; }
            return streak >= 2;
        }
        case 'DIGITUNDER': {
            if (barrier === null) return true;
            // reversal: ≥2 consecutive digits > barrier → bet UNDER
            let streak = 0;
            for (const d of recent) { if (d > barrier) streak++; else break; }
            return streak >= 2;
        }
        default:
            return digits.length >= 3; // fallback: just need some data
    }
}

/* ─── Single-condition evaluation (LDP pattern engine) ─── */
function evaluateSingleCondition(digits: number[], cond: StrategyCondition): boolean {
    if (digits.length < cond.ifLast) return false;
    const recent = digits.slice(0, cond.ifLast);
    const v = cond.digitValue ?? 5;

    // Build a per-digit predicate based on digitsIs
    const matchFn = (d: number, prev: number | null): boolean => {
        switch (cond.digitsIs) {
            case 'ODD':        return d % 2 !== 0;
            case 'EVEN':       return d % 2 === 0;
            case 'OVER':       return d > v;
            case 'UNDER':      return d < v;
            case 'MATCHES':    return d === v;
            case 'DIFFERS':    return d !== v;
            case 'HIGH TICK':  return d >= 8;
            case 'LOW TICK':   return d <= 1;
            case 'RISE':
            case 'RISE EQUAL':
            case 'HIGHER':
            case 'ONLY UPS':   return prev === null || d >= prev;
            case 'FALL':
            case 'FALL EQUAL':
            case 'LOWER':
            case 'ONLY DOWNS': return prev === null || d <= prev;
            case 'RISE RESET': return d >= 5;
            case 'FALL RESET': return d <= 4;
            case 'ASIAN UP':   return d > 4;
            case 'ASIAN DOWN': return d <= 4;
            default:           return true;
        }
    };

    if (cond.strict) {
        let prev: number | null = null;
        for (const d of recent) { if (!matchFn(d, prev)) return false; prev = d; }
        return true;
    } else {
        let count = 0, prev: number | null = null;
        for (const d of recent) { if (matchFn(d, prev)) count++; prev = d; }
        return count > recent.length / 2;
    }
}

/* ─── Strategy Logic evaluation (OR-grouped AND-conditions) ─── */
function evaluateStrategyLogic(digits: number[], groups: StrategyOrGroup[]): { hit: boolean; group?: StrategyOrGroup } {
    for (const g of groups) {
        // All conditions in the group must pass (AND logic)
        const allPass = g.conditions.every(cond => evaluateSingleCondition(digits, cond));
        if (allPass) return { hit: true, group: g };
    }
    return { hit: false };
}

/* Helper: recovery limit = minimum across all conditions in the fired group */
function groupRecoveryLimit(g: StrategyOrGroup): number {
    return Math.min(...g.conditions.map(c => c.recoveryLimit));
}

function getLastDigit(q: number): number {
    const s = q.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

function contractLabel(bot: TScalperBot): string {
    if (bot.contractType === 'DIGITEVEN')  return 'EVEN';
    if (bot.contractType === 'DIGITODD')   return 'ODD';
    if (bot.contractType === 'DIGITOVER')  return `OVER ${bot.prediction}`;
    if (bot.contractType === 'DIGITUNDER') return `UNDER ${bot.prediction}`;
    return bot.contractType;
}

/* ─── Account Badge ─── */
const AccountBadge: React.FC = () => {
    const [isDemo, setIsDemo] = useState(false);
    useEffect(() => {
        const check = () => {
            const id = localStorage.getItem('active_loginid') || '';
            setIsDemo(id.startsWith('VRTC') || id.startsWith('VR'));
        };
        check();
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, []);
    return <span className={`sb-acct-badge ${isDemo ? 'demo' : 'real'}`}>{isDemo ? '🔵 DEMO' : '🟢 REAL'}</span>;
};

/* ─── Number Field ───
   Keeps its own text buffer so the user can freely clear/retype a value —
   only clamps/commits the numeric value on blur or Enter, never mid-keystroke. */
const NumberField: React.FC<{
    value: number;
    onCommit: (n: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    className?: string;
}> = ({ value, onCommit, min, max, disabled, className }) => {
    const [text, setText] = useState(String(value));
    const focusedRef = useRef(false);

    useEffect(() => {
        if (!focusedRef.current) setText(String(value));
    }, [value]);

    const commit = () => {
        focusedRef.current = false;
        let n = parseFloat(text);
        if (Number.isNaN(n)) n = value;
        if (min != null) n = Math.max(min, n);
        if (max != null) n = Math.min(max, n);
        setText(String(n));
        if (n !== value) onCommit(n);
    };

    return (
        <input
            type='text'
            inputMode='decimal'
            className={`sb-num-input ${className || ''}`}
            disabled={disabled}
            value={text}
            onFocus={() => { focusedRef.current = true; }}
            onChange={e => {
                const v = e.target.value;
                if (v === '' || /^-?\d*\.?\d*$/.test(v)) setText(v);
            }}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
    );
};

/* ─── Accordion Section ─── */
const SbAccordion: React.FC<{ title: string; badge?: string; badgeColor?: string; defaultOpen?: boolean; children: React.ReactNode }> = ({
    title, badge, badgeColor = '#22c55e', defaultOpen = false, children,
}) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className={`sb-accordion ${open ? 'open' : ''}`}>
            <button className='sb-accordion__header' onClick={() => setOpen(v => !v)}>
                <span className='sb-accordion__title'>{title}</span>
                {badge && <span className='sb-accordion__badge' style={{ background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}44` }}>{badge}</span>}
                <span className='sb-accordion__arrow'>{open ? '▲' : '▼'}</span>
            </button>
            {open && <div className='sb-accordion__body'>{children}</div>}
        </div>
    );
};

/* ══════════════════════════════════════════════
   BotDetail — full configure + run view
   ══════════════════════════════════════════════ */
const BotDetail: React.FC<{
    bot: TScalperBot;
    derivTrade: ReturnType<typeof useDerivTrade>;
    onBack: () => void;
    onLoadXml: (bot: TScalperBot) => Promise<void>;
    onLoadAndRun: (bot: TScalperBot) => Promise<void>;
    onPreloadXml: (bot: TScalperBot) => Promise<void>;
}> = ({ bot, derivTrade, onBack, onLoadXml, onLoadAndRun, onPreloadXml }) => {
    const [cfg, setCfg]         = useState<BotConfig>(() => DEFAULT_CONFIG(bot));
    const [running, setRunning] = useState(false);
    const [scanning, setScanning] = useState(false); // terminal scanning without trading
    const [tab, setTab]         = useState<'summary' | 'transactions' | 'journal'>('summary');
    const [terminal, setTerminal] = useState<{ t: string; msg: string; kind: string }[]>([]);
    const [txList, setTxList]   = useState<TxRecord[]>([]);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    const [loadingXml, setLoadingXml] = useState(false);
    const [entryReady, setEntryReady] = useState(false); // lights up when entry signal detected
    const [activeMarket, setActiveMarket] = useState(cfg.market);
    const [addMarketSel, setAddMarketSel] = useState('1HZ50V');
    const [digitDisplay, setDigitDisplay] = useState<number[]>([]); // reactive copy for rendering
    const [winPopup, setWinPopup] = useState<{ profit: number; stopped: boolean } | null>(null);

    const stopRef         = useRef(false);
    const consLossRef     = useRef(0);
    const sessionPnlRef   = useRef(0);
    const txIdRef         = useRef(0);
    const termRef         = useRef<HTMLDivElement>(null);
    const digitWindowRef  = useRef<number[]>([]);
    const tickUnsubRef    = useRef<(() => void) | null>(null);
    const marketIdxRef    = useRef(0);
    const lastFiredGroupRef = useRef<StrategyCondition | null>(null);
    const multiWindowsRef = useRef<Map<string, number[]>>(new Map());
    const multiUnsubsRef  = useRef<Map<string, () => void>>(new Map());
    const readyMarketRef  = useRef<string | null>(null);

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);
    useEffect(() => { setActiveMarket(cfg.market); }, [cfg.market]);

    const summary = useMemo(() => {
        const won  = txList.filter(t => t.result === 'won').length;
        const lost = txList.filter(t => t.result === 'lost').length;
        const pnl  = txList.reduce((a, t) => a + t.profit, 0);
        return { runs: txList.length, won, lost, pnl };
    }, [txList]);

    const ts = () => new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const addLog = useCallback((msg: string, kind = 'info') => {
        setTerminal(prev => [{ t: ts(), msg, kind }, ...prev].slice(0, 300));
    }, []);

    useEffect(() => {
        if (termRef.current) termRef.current.scrollTop = 0;
    }, [terminal.length]);

    const cfgSet = (patch: Partial<BotConfig>) => setCfg(prev => ({ ...prev, ...patch }));
    const rmSet  = (patch: Partial<RiskManagerConfig>) =>
        setCfg(prev => ({ ...prev, riskManager: { ...prev.riskManager, ...patch } }));
    const slSet  = (patch: Partial<StrategyLogicConfig>) =>
        setCfg(prev => ({ ...prev, strategyLogic: { ...prev.strategyLogic, ...patch } }));
    const groupSet = (id: string, patch: Partial<StrategyCondition>) =>
        setCfg(prev => ({
            ...prev,
            strategyLogic: {
                ...prev.strategyLogic,
                groups: prev.strategyLogic.groups.map(g => g.id === id ? { ...g, ...patch } : g),
            },
        }));
    const addGroup = () => setCfg(prev => ({
        ...prev,
        strategyLogic: { ...prev.strategyLogic, groups: [...prev.strategyLogic.groups, newCondition(bot)] },
    }));
    const removeGroup = (id: string) => setCfg(prev => ({
        ...prev,
        strategyLogic: { ...prev.strategyLogic, groups: prev.strategyLogic.groups.filter(g => g.id !== id) },
    }));

    /* ── Subscribe to ticks for the active market ── */
    const subscribeMarket = useCallback((market: string) => {
        if (tickUnsubRef.current) { tickUnsubRef.current(); tickUnsubRef.current = null; }
        digitWindowRef.current = [];
        setDigitDisplay([]);
        const unsub = derivTrade.subscribeTicks(market, tick => {
            const d = tick.digit != null ? tick.digit : getLastDigit(tick.quote);
            digitWindowRef.current = [d, ...digitWindowRef.current].slice(0, 50);
            setDigitDisplay(prev => [d, ...prev].slice(0, 20));
        });
        tickUnsubRef.current = unsub;
        setActiveMarket(market);
    }, [derivTrade]);

    /* Cleanup on unmount */
    useEffect(() => () => {
        if (tickUnsubRef.current) tickUnsubRef.current();
        multiUnsubsRef.current.forEach(u => u());
        multiUnsubsRef.current.clear();
    }, []);

    /* ── Parallel multi-market scanning: subscribe every configured market at once and
         flag the first one whose Strategy Logic condition fires ── */
    const subscribeAllMarkets = useCallback((markets: string[]) => {
        markets.forEach(market => {
            if (multiUnsubsRef.current.has(market)) return;
            multiWindowsRef.current.set(market, []);
            const unsub = derivTrade.subscribeTicks(market, tick => {
                const d = tick.digit != null ? tick.digit : getLastDigit(tick.quote);
                const win = [d, ...(multiWindowsRef.current.get(market) || [])].slice(0, 50);
                multiWindowsRef.current.set(market, win);
                if (!readyMarketRef.current) {
                    const r = evaluateStrategyLogic(win, cfg.strategyLogic.groups);
                    if (r.hit) {
                        readyMarketRef.current = market;
                        lastFiredGroupRef.current = r.group ?? null;
                    }
                }
            });
            multiUnsubsRef.current.set(market, unsub);
        });
    }, [derivTrade, cfg.strategyLogic.groups]);

    const unsubscribeAllMarkets = useCallback(() => {
        multiUnsubsRef.current.forEach(u => u());
        multiUnsubsRef.current.clear();
        multiWindowsRef.current.clear();
        readyMarketRef.current = null;
    }, []);

    /* ── Hacker startup sequence ── */
    const runHackerStartup = async (market: string, multiMarket: boolean) => {
        const msgs = [
            `STATUS: ONLINE TURBO`,
            `CONNECTION_SPEED: ${118 + Math.floor(Math.random() * 32)} Mbps`,
            'INJECTING_RECOVERY_PROTOCOL...',
            'BYPASSING FIREWALL...',
            'BUFFER_OVERFLOW_CHECK: PASS',
            `MULTIPLE_MARKET_SYNC: ${multiMarket ? 'ENABLED' : 'DISABLED'}`,
            `SECURE_TUNNEL: ESTABLISHED → ${market}`,
            'DDOS_PROTECTION: BYPASSED',
            'ENCRYPTING RSA_2048_KEYS',
            `SIGNAL_PROCESSOR: ONLINE — ${contractLabel(bot)}`,
            'MARKET_FEED_INTEGRITY: OK',
        ];
        for (const m of msgs) {
            if (stopRef.current) return;
            addLog(m, 'hack');
            await new Promise(r => setTimeout(r, 90 + Math.random() * 70));
        }
    };

    /* ── Start bot (with real tick entry detection) ── */
    const startBot = useCallback(async () => {
        if (running || !derivTrade.authorized) return;
        stopRef.current    = false;
        consLossRef.current = 0;
        sessionPnlRef.current = 0;
        marketIdxRef.current  = 0;
        lastFiredGroupRef.current = null;
        setRunning(true);
        setEntryReady(false);
        setTerminal([]);
        setWinPopup(null);

        /* Determine market list */
        const marketList = cfg.useMarketSwitch && cfg.markets.length > 0
            ? [...cfg.markets] : [cfg.market];
        const multiScan = bot.category === 'Even/Odd' && cfg.strategyLogic.active
            && cfg.useMarketSwitch && marketList.length > 1;
        let curMarketIdx = 0;
        let curMarket    = marketList[curMarketIdx];

        /* Silently load this bot's default XML into the Bot Builder workspace so the
           real Blockly bot is always in sync with the terminal-driven engine, without
           navigating the user away from this page. */
        onPreloadXml(bot).then(() => addLog('📂 XML_TRADING_ACTIVATOR: DEFAULT STRATEGY LOADED', 'hack')).catch(() => {});

        /* Subscribe to first market (or all markets at once for parallel multi-market scan) */
        if (multiScan) {
            subscribeAllMarkets(marketList);
        } else {
            subscribeMarket(curMarket);
        }
        addLog(`▶ BOT ENGINE STARTED — ${contractLabel(bot)}`, 'start');
        await runHackerStartup(curMarket, cfg.useMarketSwitch);

        let curStake = cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake;
        let martCount = 0; // consecutive losses for martingale

        while (!stopRef.current) {
            try {
                /* ── Scan for entry signal ── */
                addLog(`📡 SCANNING → ${multiScan ? marketList.join(', ') : curMarket} | ${contractLabel(bot)}`, 'scan');
                setEntryReady(false);

                let scanTick = 0;
                let entry = false;
                while (!entry && !stopRef.current) {
                    if (multiScan) {
                        if (readyMarketRef.current) {
                            curMarket = readyMarketRef.current;
                            readyMarketRef.current = null;
                            digitWindowRef.current = multiWindowsRef.current.get(curMarket) || [];
                            setActiveMarket(curMarket);
                            setDigitDisplay(digitWindowRef.current.slice(0, 20));
                            addLog(`🧬 STRATEGY_LOGIC: CONDITION MET ON ${curMarket} — XML_TRADING_ACTIVATOR ENGAGED`, 'switch');
                            entry = true;
                            break;
                        }
                    } else if (bot.category === 'Even/Odd' && cfg.strategyLogic.active && cfg.strategyLogic.groups.length > 0) {
                        const r = evaluateStrategyLogic(digitWindowRef.current, cfg.strategyLogic.groups);
                        if (r.hit) {
                            lastFiredGroupRef.current = r.group ?? null;
                            addLog('🧬 STRATEGY_LOGIC: CONDITION MET — XML_TRADING_ACTIVATOR ENGAGED', 'switch');
                            entry = true;
                            break;
                        }
                    } else {
                        entry = checkEntry(digitWindowRef.current, bot.contractType, bot.prediction);
                    }
                    scanTick++;

                    if (!entry) {
                        /* Periodic hacker/analysis messages */
                        if (scanTick % 4 === 1) {
                            const recent = digitWindowRef.current.slice(0, 10).join(' ');
                            addLog(`ANALYZING_DIGIT_PATTERN: [${recent || '...'}]`, 'scan');
                        }
                        if (scanTick % 8 === 3) {
                            addLog(HACK_SCAN_MSGS[Math.floor(Math.random() * HACK_SCAN_MSGS.length)], 'hack');
                        }
                        if (scanTick % 10 === 5) {
                            addLog(`CONNECTION_SPEED: ${105 + Math.floor(Math.random() * 40)} Mbps`, 'hack');
                        }
                        await new Promise(r => setTimeout(r, multiScan ? 250 : 600));
                    }
                }

                if (stopRef.current) break;

                setEntryReady(true);
                addLog('⚡ ENTRY_SIGNAL: DETECTED — EXECUTING TRADE', 'entry');
                await new Promise(r => setTimeout(r, 120));

                /* ── Execute trade ── */
                const txId = ++txIdRef.current;
                const openTx: TxRecord = {
                    id: txId, time: ts(), market: curMarket,
                    type: contractLabel(bot), stake: curStake,
                    barrier: bot.prediction, result: 'open', profit: 0, exitDigit: null,
                };
                setTxList(prev => [openTx, ...prev]);

                const params: any = {
                    symbol: curMarket,
                    contract_type: bot.contractType,
                    duration: cfg.duration,
                    duration_unit: 't',
                    stake: curStake,
                };
                if (bot.prediction !== null) params.barrier = String(bot.prediction);

                const profit = await new Promise<number>((resolve, reject) => {
                    derivTrade.buyContract(params, settled => {
                        const p = applyCommission(settled.profit ?? 0);
                        const exitDigit = settled.exit_spot != null
                            ? getLastDigit(Number(settled.exit_spot)) : null;
                        const result: TxRecord['result'] = p > 0 ? 'won' : 'lost';
                        setTxList(prev => prev.map(t =>
                            t.id === txId ? { ...t, result, profit: p, exitDigit } : t
                        ));
                        resolve(p);
                    }).catch(reject);
                });

                if (stopRef.current) break;
                setEntryReady(false);

                const won = profit > 0;
                sessionPnlRef.current = +(sessionPnlRef.current + profit).toFixed(2);
                const pnlStr = `${sessionPnlRef.current >= 0 ? '+' : ''}${sessionPnlRef.current.toFixed(2)} USD`;

                if (won) {
                    consLossRef.current = 0;
                    const wasRecovering = martCount > 0;
                    martCount = 0;
                    lastFiredGroupRef.current = null;
                    /* Reset stake after win */
                    curStake = cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake;
                    addLog(`✅ WIN  +${profit.toFixed(2)} USD  |  P/L: ${pnlStr}`, 'win');

                    if (!bot.multiple) {
                        addLog('🎉 TICK WIN — Bot stopped.', 'win');
                        setWinPopup({ profit, stopped: true });
                        break;
                    }

                    /* TP check */
                    if (cfg.tpGuard && sessionPnlRef.current >= cfg.takeProfit) {
                        addLog(`🎯 Take profit ${cfg.takeProfit} reached.`, 'stop');
                        setWinPopup({ profit, stopped: true });
                        break;
                    }

                    setWinPopup({ profit, stopped: false });
                    addLog(wasRecovering
                        ? '🔄 Recovery successful — returning to market scan...'
                        : '🔄 Returning to market scan...', 'scan');
                } else {
                    consLossRef.current++;
                    martCount++;

                    /* Martingale: only if RM activate limit reached */
                    const rm = cfg.riskManager;
                    const useMartingale = rm.inject && rm.active && rm.onLose
                        ? martCount >= rm.activateLimit && martCount <= rm.deactivateLimit
                        : !rm.inject; // when not injected, always use cfg.martingale

                    const multiplier = rm.inject && rm.active ? rm.multiplier : cfg.martingale;
                    const nextStake  = useMartingale
                        ? +(curStake * multiplier).toFixed(2)
                        : curStake;

                    /* A fired Strategy Logic condition can cap recovery attempts tighter
                       than the general consecutive-loss limit. */
                    const effectiveLossLimit = lastFiredGroupRef.current
                        ? Math.min(cfg.consecutiveLossLimit || Infinity, lastFiredGroupRef.current.recoveryLimit)
                        : cfg.consecutiveLossLimit;

                    addLog(`❌ LOSS  ${profit.toFixed(2)} USD  |  recovery: ${martCount}/${effectiveLossLimit === Infinity ? '∞' : effectiveLossLimit}  |  next: ${nextStake.toFixed(2)}`, 'loss');
                    addLog('🛡 RECOVERY_MODE: ENGAGED — awaiting next entry signal', 'switch');

                    /* Stop on consecutive losses (bounded by Strategy Logic recovery limit) */
                    if ((cfg.stopOnLoss || lastFiredGroupRef.current) && consLossRef.current >= effectiveLossLimit) {
                        /* Market switch? */
                        if (cfg.useMarketSwitch && cfg.markets.length > 1 && !multiScan) {
                            curMarketIdx = (curMarketIdx + 1) % marketList.length;
                            curMarket    = marketList[curMarketIdx];
                            consLossRef.current = 0;
                            martCount = 0;
                            curStake  = cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake;
                            subscribeMarket(curMarket);
                            addLog(`🔀 MARKET_SWITCH → ${curMarket} (reset after ${effectiveLossLimit} losses)`, 'switch');
                            continue;
                        }
                        addLog(`🛑 Stop loss hit — stopped after ${consLossRef.current} consecutive losses.`, 'stop');
                        break;
                    }

                    /* SL/TP check */
                    if (cfg.tpGuard) {
                        if (sessionPnlRef.current >= cfg.takeProfit) {
                            addLog(`🎯 Take profit ${cfg.takeProfit} reached.`, 'stop');
                            break;
                        }
                        if (sessionPnlRef.current <= -Math.abs(cfg.stopLoss)) {
                            addLog(`🛡 Stop loss -${cfg.stopLoss} triggered.`, 'stop');
                            break;
                        }
                    }

                    curStake = Math.max(0.35, nextStake);
                }
            } catch (err: any) {
                addLog(`⚠ ${err?.error?.message || err?.message || 'Trade error — retrying...'}`, 'error');
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        if (tickUnsubRef.current) { tickUnsubRef.current(); tickUnsubRef.current = null; }
        if (multiScan) unsubscribeAllMarkets();
        addLog('⏹ Bot stopped.', 'info');
        setRunning(false);
        setEntryReady(false);
    }, [running, derivTrade, bot, cfg, addLog, subscribeMarket, subscribeAllMarkets, unsubscribeAllMarkets, onPreloadXml]);

    const stopBot = useCallback(() => {
        stopRef.current = true;
        addLog('⏸ Stop signal sent...', 'info');
    }, [addLog]);

    /* Add/remove markets from multi-market list */
    const addMarket = () => {
        if (!cfg.markets.includes(addMarketSel)) {
            cfgSet({ markets: [...cfg.markets, addMarketSel] });
        }
    };
    const removeMarket = (m: string) => cfgSet({ markets: cfg.markets.filter(x => x !== m) });

    const marketLabel = (v: string) => ALL_MARKETS.find(m => m.value === v)?.label ?? v;

    return (
        <div className='sb-detail'>
            {/* ── Header ── */}
            <div className='sb-detail__header'>
                <button className='sb-detail__back' onClick={onBack}>‹ Bots</button>
                <div className='sb-detail__title'>
                    <span className='sb-detail__icon'>
                        {bot.contractType.includes('EVEN') ? '2️⃣' : bot.contractType.includes('ODD') ? '1️⃣' : bot.contractType.includes('OVER') ? '⬆️' : '⬇️'}
                    </span>
                    <div>
                        <h2>{bot.name}</h2>
                        <span className={`sb-detail__status ${running ? 'running' : 'stopped'}`}>
                            STATUS: {running ? '● RUNNING' : '○ STOPPED'}
                        </span>
                    </div>
                </div>
                <div className='sb-detail__header-right'>
                    <AccountBadge />
                    {derivTrade.balance !== null && (
                        <span className='sb-detail__balance'>{derivTrade.currency} {derivTrade.balance.toFixed(2)}</span>
                    )}
                    {!running ? (
                        <button className='sb-detail__start-btn' onClick={startBot} disabled={!derivTrade.authorized}>
                            {derivTrade.authorized ? '▶ RUN' : '○ Connecting...'}
                        </button>
                    ) : (
                        <button className='sb-detail__stop-btn' onClick={stopBot}>⏹ STOP</button>
                    )}
                    <button className='sb-detail__load-btn' disabled={loadingXml}
                        onClick={() => { setLoadingXml(true); onLoadXml(bot).finally(() => setLoadingXml(false)); }}>
                        📂 Builder
                    </button>
                </div>
            </div>

            {/* ── Body ── */}
            <div className='sb-detail__body'>
                {/* ── Left Sidebar — Config ── */}
                <div className='sb-detail__sidebar'>

                    {/* Builder buttons */}
                    <div className='sb-bot-actions'>
                        <button className='sb-bot-action-btn' onClick={() => { setLoadingXml(true); onLoadXml(bot).finally(() => setLoadingXml(false)); }} disabled={loadingXml}>
                            📁 DEFAULT BOT
                        </button>
                        <button className='sb-bot-action-btn' onClick={() => { setLoadingXml(true); onLoadAndRun(bot).finally(() => setLoadingXml(false)); }} disabled={loadingXml}>
                            ▶ SELECT BOT
                        </button>
                        <button className='sb-bot-action-btn' disabled>
                            ⬆ UPLOAD BOT
                        </button>
                        <button className='sb-bot-action-btn' disabled>
                            ⬇ DOWNLOAD
                        </button>
                    </div>

                    {/* ── GLOBAL SHARED ── */}
                    <div className='sb-global-label'>GLOBAL SHARED</div>

                    {/* Trade Parameters */}
                    <SbAccordion title='Trade Parameters' badge='ACTIVE' defaultOpen>
                        <div className='sb-field'>
                            <label>Market</label>
                            <select value={cfg.market} onChange={e => cfgSet({ market: e.target.value })} disabled={running}>
                                {ALL_MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div className='sb-field'>
                            <label>Contract</label>
                            <span className='sb-badge'>{contractLabel(bot)}</span>
                        </div>
                        <div className='sb-field-row'>
                            <div className='sb-field'>
                                <label>Duration</label>
                                <NumberField value={cfg.duration} min={1} max={10}
                                    onCommit={n => cfgSet({ duration: n })} disabled={running} />
                                <span className='sb-unit'>Ticks</span>
                            </div>
                            <div className='sb-field'>
                                <label>Stake (USD)</label>
                                <NumberField value={cfg.stake} min={0.35} step={0.01}
                                    onCommit={n => cfgSet({ stake: n })} disabled={running} />
                            </div>
                        </div>
                        <div className='sb-field'>
                            <label>Mode</label>
                            <span className='sb-badge'>{bot.multiple ? 'Multiple runs' : 'Single run (stop on win)'}</span>
                        </div>
                    </SbAccordion>

                    {/* Stop Trading */}
                    <SbAccordion title='Stop Trading' badge={cfg.stopOnLoss ? 'ACTIVE' : 'DISABLED'} badgeColor={cfg.stopOnLoss ? '#22c55e' : '#64748b'} defaultOpen>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Stop After Losses</label>
                            <button className={`sb-toggle ${cfg.stopOnLoss ? 'on' : 'off'}`}
                                onClick={() => cfgSet({ stopOnLoss: !cfg.stopOnLoss })} disabled={running}>
                                {cfg.stopOnLoss ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        {cfg.stopOnLoss && (
                            <>
                                <div className='sb-field'>
                                    <label>Consecutive Losses</label>
                                    <NumberField value={cfg.consecutiveLossLimit} min={1} max={20}
                                        onCommit={n => cfgSet({ consecutiveLossLimit: n })} disabled={running} />
                                </div>
                                <p className='sb-hint'>Bot stops after {cfg.consecutiveLossLimit} consecutive losses.</p>
                            </>
                        )}
                    </SbAccordion>

                    {/* TP/SL Guard */}
                    <SbAccordion title='TP/SL Guard' badge={cfg.tpGuard ? 'ACTIVE' : 'DISABLED'} badgeColor={cfg.tpGuard ? '#22c55e' : '#64748b'} defaultOpen>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>TP/SL Guard</label>
                            <button className={`sb-toggle ${cfg.tpGuard ? 'on' : 'off'}`}
                                onClick={() => cfgSet({ tpGuard: !cfg.tpGuard })} disabled={running}>
                                {cfg.tpGuard ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        {cfg.tpGuard && (
                            <>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Take Profit ($)</label>
                                        <NumberField value={cfg.takeProfit} min={1}
                                            onCommit={n => cfgSet({ takeProfit: n })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Stop Loss ($)</label>
                                        <NumberField value={cfg.stopLoss} min={1}
                                            onCommit={n => cfgSet({ stopLoss: n })} disabled={running} />
                                    </div>
                                </div>
                                <div className='sb-tpsl-bar'>
                                    <span className='sb-tpsl-tp'>TP +{cfg.takeProfit}</span>
                                    <span className='sb-tpsl-sl'>SL -{cfg.stopLoss}</span>
                                </div>
                            </>
                        )}
                    </SbAccordion>

                    {/* Strategy Logic */}
                    <SbAccordion title='💡 Strategy Logic' badge={cfg.strategyLogic.active ? 'ACTIVE' : 'DISABLED'} badgeColor={cfg.strategyLogic.active ? '#22c55e' : '#64748b'} defaultOpen>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Global Shared</label>
                            <button className={`sb-toggle ${cfg.strategyLogic.globalShared ? 'on' : 'off'}`}
                                onClick={() => slSet({ globalShared: !cfg.strategyLogic.globalShared })} disabled={running}>
                                {cfg.strategyLogic.globalShared ? 'ENABLED' : 'DISABLED'}
                            </button>
                        </div>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Strategy</label>
                            <button className={`sb-toggle ${cfg.strategyLogic.active ? 'on' : 'off'}`}
                                onClick={() => slSet({ active: !cfg.strategyLogic.active })} disabled={running || bot.category !== 'Even/Odd'}>
                                {cfg.strategyLogic.active ? 'ACTIVE' : 'INACTIVE'}
                            </button>
                        </div>
                        {bot.category !== 'Even/Odd' ? (
                            <p className='sb-hint'>This bot trades on barrier-reversal logic (OVER/UNDER) — the condition builder applies to Even/Odd scalpers.</p>
                        ) : cfg.strategyLogic.active && (
                            <>
                                {cfg.strategyLogic.groups.map((g, idx) => (
                                    <div key={g.id} className='sb-or-group'>
                                        <div className='sb-or-group__header'>
                                            <span className='sb-or-group__badge'>OR GROUP #{idx + 1}</span>
                                        </div>
                                        <div className='sb-or-group__body'>
                                            <div className='sb-field-row sb-field-row--center'>
                                                <span className='sb-condition-label'>CONDITION</span>
                                                {cfg.strategyLogic.groups.length > 1 && !running && (
                                                    <button className='sb-condition-delete' onClick={() => removeGroup(g.id)} title='Delete condition'>🗑</button>
                                                )}
                                            </div>
                                            <div className='sb-field'>
                                                <label>Algorithm</label>
                                                <select value={g.algorithm} onChange={() => {}} disabled={running}>
                                                    <option value='LDP'>LDP — Last Digit Pattern</option>
                                                </select>
                                            </div>
                                            <div className='sb-field-row'>
                                                <div className='sb-field-row sb-field-row--center'>
                                                    <label>Strict</label>
                                                    <button className={`sb-toggle ${g.strict ? 'on' : 'off'}`}
                                                        onClick={() => groupSet(g.id, { strict: !g.strict })} disabled={running}>
                                                        {g.strict ? 'ACTIVE' : 'OFF'}
                                                    </button>
                                                </div>
                                                <div className='sb-field'>
                                                    <label>If Last</label>
                                                    <NumberField value={g.ifLast} min={1} max={20}
                                                        onCommit={n => groupSet(g.id, { ifLast: n })} disabled={running} />
                                                </div>
                                            </div>
                                            <div className='sb-field-row'>
                                                <div className='sb-field'>
                                                    <label>Digits Is</label>
                                                    <select value={g.digitsIs} onChange={e => groupSet(g.id, { digitsIs: e.target.value as 'ODD' | 'EVEN' })} disabled={running}>
                                                        <option value='ODD'>ODD</option>
                                                        <option value='EVEN'>EVEN</option>
                                                    </select>
                                                </div>
                                                <div className='sb-field'>
                                                    <label>Recovery Limit</label>
                                                    <NumberField value={g.recoveryLimit} min={1} max={20}
                                                        onCommit={n => groupSet(g.id, { recoveryLimit: n })} disabled={running} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {!running && (
                                    <button className='sb-add-condition-btn' onClick={addGroup}>+ ADD OR GROUP</button>
                                )}
                                <p className='sb-hint'>When the condition is true, the terminal fires the XML trading activator and executes the trade automatically.</p>
                            </>
                        )}
                    </SbAccordion>

                    {/* Risk Manager */}
                    <SbAccordion title='Risk Manager' badge={cfg.riskManager.inject ? 'INJECTED' : 'STANDARD'} badgeColor={cfg.riskManager.inject ? '#f59e0b' : '#64748b'}>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Inject Risk Manager</label>
                            <button className={`sb-toggle ${cfg.riskManager.inject ? 'on' : 'off'}`}
                                onClick={() => rmSet({ inject: !cfg.riskManager.inject })} disabled={running}>
                                {cfg.riskManager.inject ? 'ENABLED' : 'DISABLED'}
                            </button>
                        </div>
                        {cfg.riskManager.inject ? (
                            <>
                                <div className='sb-rm-type'>Martingale <span className='sb-rm-info'>ⓘ</span></div>
                                <div className='sb-field-row sb-field-row--center'>
                                    <label>Risk Manager</label>
                                    <button className={`sb-toggle ${cfg.riskManager.active ? 'on' : 'off'}`}
                                        onClick={() => rmSet({ active: !cfg.riskManager.active })} disabled={running}>
                                        {cfg.riskManager.active ? 'ACTIVE' : 'INACTIVE'}
                                    </button>
                                </div>
                                <div className='sb-field-row sb-field-row--center'>
                                    <label>On Lose</label>
                                    <button className={`sb-toggle ${cfg.riskManager.onLose ? 'on' : 'off'}`}
                                        onClick={() => rmSet({ onLose: !cfg.riskManager.onLose })} disabled={running}>
                                        {cfg.riskManager.onLose ? 'ACTIVE' : 'INACTIVE'}
                                    </button>
                                </div>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Activate Limit</label>
                                        <NumberField value={cfg.riskManager.activateLimit} min={1} max={50}
                                            onCommit={n => rmSet({ activateLimit: n })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Deactivate Limit</label>
                                        <NumberField value={cfg.riskManager.deactivateLimit} min={1} max={500}
                                            onCommit={n => rmSet({ deactivateLimit: n })} disabled={running} />
                                    </div>
                                </div>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Multiplier</label>
                                        <NumberField value={cfg.riskManager.multiplier} min={1} max={10} step={0.5}
                                            onCommit={n => rmSet({ multiplier: n })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Stake (override)</label>
                                        <NumberField value={cfg.riskManager.overrideStake} min={0.35} step={0.01}
                                            onCommit={n => rmSet({ overrideStake: n })} disabled={running} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className='sb-field'>
                                    <label>Martingale ×</label>
                                    <NumberField value={cfg.martingale} min={1} max={10} step={0.5}
                                        onCommit={n => cfgSet({ martingale: n })} disabled={running} />
                                </div>
                                <p className='sb-hint'>Standard martingale — stake × {cfg.martingale} on each loss.</p>
                            </>
                        )}
                    </SbAccordion>

                    {/* Market Switcher */}
                    <SbAccordion title='Market Switcher' badge={cfg.useMarketSwitch ? 'ACTIVE' : 'OFF'} badgeColor={cfg.useMarketSwitch ? '#06b6d4' : '#64748b'}>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Auto Switch Markets</label>
                            <button className={`sb-toggle ${cfg.useMarketSwitch ? 'on' : 'off'}`}
                                onClick={() => cfgSet({ useMarketSwitch: !cfg.useMarketSwitch })} disabled={running}>
                                {cfg.useMarketSwitch ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        {cfg.useMarketSwitch && (
                            <>
                                <div className='sb-field'>
                                    <label>Switch After Losses</label>
                                    <NumberField value={cfg.switchOnLosses} min={1} max={10}
                                        onCommit={n => cfgSet({ switchOnLosses: n })} disabled={running} />
                                    <span className='sb-unit'>losses</span>
                                </div>
                                <p className='sb-hint'>Switches to the next market after {cfg.switchOnLosses} consecutive losses.</p>
                                <div className='sb-markets-list'>
                                    {cfg.markets.map(m => (
                                        <div key={m} className='sb-market-pill'>
                                            <span>{marketLabel(m)}</span>
                                            {!running && (
                                                <button className='sb-market-remove' onClick={() => removeMarket(m)}>×</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {!running && (
                                    <div className='sb-add-market'>
                                        <select value={addMarketSel} onChange={e => setAddMarketSel(e.target.value)}>
                                            {ALL_MARKETS.filter(m => !cfg.markets.includes(m.value)).map(m => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                        <button className='sb-add-market-btn' onClick={addMarket}>+ ADD</button>
                                    </div>
                                )}
                            </>
                        )}
                    </SbAccordion>

                    {/* MARKET1 Section */}
                    <SbAccordion title='MARKET 1' badge={contractLabel(bot)} badgeColor='#3b82f6'>
                        <div className='sb-field'>
                            <label>Contract Type</label>
                            <span className='sb-badge'>{contractLabel(bot)}</span>
                        </div>
                        <div className='sb-field'>
                            <label>Market</label>
                            <span className='sb-badge'>{marketLabel(cfg.market)}</span>
                        </div>
                        {bot.prediction !== null && (
                            <div className='sb-field'>
                                <label>Barrier / Digit</label>
                                <span className='sb-badge'>{bot.prediction}</span>
                            </div>
                        )}
                        <div className='sb-field'>
                            <label>Signal ID</label>
                            <span className='sb-badge'>Signal_1</span>
                        </div>
                        <p className='sb-hint'>Entry condition: {
                            bot.contractType === 'DIGITEVEN' ? '≥3 consecutive ODD digits → bet EVEN' :
                            bot.contractType === 'DIGITODD'  ? '≥3 consecutive EVEN digits → bet ODD' :
                            bot.contractType === 'DIGITOVER' ? `≥2 consecutive digits ≤${bot.prediction} → bet OVER` :
                            `≥2 consecutive digits >${bot.prediction} → bet UNDER`
                        }</p>
                    </SbAccordion>
                </div>

                {/* ── Right — Terminal ── */}
                <div className='sb-detail__terminal-col'>
                    {winPopup && (
                        <div className={`sb-win-popup ${winPopup.stopped ? 'stopped' : ''}`}>
                            <span className='sb-win-popup__icon'>🎉</span>
                            <div>
                                <strong>TICK WIN +{winPopup.profit.toFixed(2)} USD</strong>
                                <p>{winPopup.stopped ? 'Bot stopped.' : 'Recovery cleared — resuming scan.'}</p>
                            </div>
                            <button onClick={() => setWinPopup(null)}>×</button>
                        </div>
                    )}
                    {/* Active market indicator */}
                    <div className='sb-terminal-market-bar'>
                        <span className='sb-terminal-market-label'>ACTIVE MARKET:</span>
                        <span className='sb-terminal-market-value'>{activeMarket}</span>
                        {entryReady && <span className='sb-entry-ready'>⚡ ENTRY SIGNAL</span>}
                        {running && <span className='sb-terminal__live'>● LIVE</span>}
                    </div>

                    {/* Live digit window */}
                    <div className='sb-digit-window'>
                        {digitDisplay.length === 0 ? (
                            <span className='sb-digit-window__empty'>waiting for ticks…</span>
                        ) : digitDisplay.map((d, i) => (
                            <span key={i} className={`sb-digit-chip ${i === 0 ? 'latest' : ''}`}>{d}</span>
                        ))}
                    </div>

                    {/* Terminal */}
                    <div className='sb-terminal'>
                        <div className='sb-terminal__bar'>
                            <div className='sb-terminal__dots'><span /><span /><span /></div>
                            <span>SCAN TERMINAL — {contractLabel(bot)}</span>
                            {running && <span className='sb-terminal__live'>● SCANNING</span>}
                        </div>
                        <div className='sb-terminal__body' ref={termRef}>
                            {terminal.length === 0 ? (
                                <div className='sb-terminal__idle'>
                                    {running ? '> Initializing scanner...' : '> Idle — press RUN to start market scan'}
                                </div>
                            ) : terminal.map((e, i) => (
                                <div key={i} className={`sb-terminal__line ${e.kind}`}>
                                    <span className='sb-terminal__ts'>{e.t}</span>
                                    {e.msg}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Bottom Tabs ── */}
            <div className='sb-tabs'>
                <div className='sb-tabs__nav'>
                    {(['summary', 'transactions', 'journal'] as const).map(t => (
                        <button key={t} className={`sb-tabs__btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                <div className='sb-tabs__panel'>
                    {tab === 'summary' && (
                        <div className='sb-summary'>
                            {summary.runs === 0 ? (
                                <div className='sb-summary__empty'>
                                    <p>Bot is not running</p>
                                    <p>When you're ready to trade, hit RUN. You'll be able to track your bot's performance here.</p>
                                </div>
                            ) : (
                                <div className='sb-summary__stats'>
                                    <div className='sb-stat'><span>TOTAL RUNS</span><strong>{summary.runs}</strong></div>
                                    <div className='sb-stat green'><span>WINS</span><strong>{summary.won}</strong></div>
                                    <div className='sb-stat red'><span>LOSSES</span><strong>{summary.lost}</strong></div>
                                    <div className={`sb-stat ${summary.pnl >= 0 ? 'green' : 'red'}`}>
                                        <span>NET P/L</span>
                                        <strong>{summary.pnl >= 0 ? '+' : ''}{summary.pnl.toFixed(2)} USD</strong>
                                    </div>
                                    <div className='sb-stat'>
                                        <span>WIN RATE</span>
                                        <strong>{summary.runs > 0 ? ((summary.won / summary.runs) * 100).toFixed(1) : '0.0'}%</strong>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'transactions' && (
                        <div className='sb-transactions'>
                            {txList.length === 0 ? (
                                <p className='sb-empty'>No transactions yet. Run the bot to start trading.</p>
                            ) : (
                                <table className='sb-tx-table'>
                                    <thead>
                                        <tr>
                                            <th>Time</th><th>Market</th><th>Type</th>
                                            <th>Stake</th><th>Result</th><th>Exit Digit</th><th>Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {txList.map(tx => (
                                            <tr key={tx.id} className={tx.result}>
                                                <td>{tx.time}</td>
                                                <td>{tx.market}</td>
                                                <td>{tx.type}</td>
                                                <td>${tx.stake.toFixed(2)}</td>
                                                <td className={`sb-result-${tx.result}`}>
                                                    {tx.result === 'open' ? '⏳' : tx.result === 'won' ? '✓ WIN' : '✗ LOSS'}
                                                </td>
                                                <td>{tx.exitDigit ?? '—'}</td>
                                                <td className={tx.profit >= 0 ? 'green' : 'red'}>
                                                    {tx.result === 'open' ? '…' : `${tx.profit >= 0 ? '+' : ''}${tx.profit.toFixed(2)}`}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {tab === 'journal' && (
                        <div className='sb-journal'>
                            {terminal.length === 0 ? (
                                <p className='sb-empty'>No journal entries yet. Run the bot to see activity.</p>
                            ) : terminal.slice().reverse().map((e, i) => (
                                <div key={i} className={`sb-journal__line ${e.kind}`}>
                                    <span className='sb-journal__ts'>{e.t}</span>
                                    {e.msg}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className='sb-tabs__disclaimer'>
                    ⚠ Risk Disclaimer: Trading involves significant risk of loss and may not be suitable for all investors.
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════
   Main ScalperBots page
   ══════════════════════════════════════════════ */
const ScalperBots: React.FC = observer(() => {
    const store      = useStore();
    const derivTrade = useDerivTrade();
    const [category, setCategory]   = useState('All');
    const [search, setSearch]       = useState('');
    const [selectedBot, setSelectedBot] = useState<TScalperBot | null>(null);

    const filtered = SCALPER_BOTS.filter(b => {
        const matchCat  = category === 'All' || b.category === category;
        const matchSrch = !search || b.name.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSrch;
    });

    const loadXmlIntoWorkspace = useCallback(async (xml: string, name: string) => {
        const lm: any = store?.load_modal;
        if (lm?.loadStrategyToBuilder) {
            try { await lm.loadStrategyToBuilder({ id: name, xml, name, save_type: 'unsaved' }, false); return true; }
            catch {}
        }
        try {
            const B = (window as any).Blockly;
            if (!B?.derivWorkspace) return false;
            const dom = B.Xml.textToDom(xml);
            B.derivWorkspace.asyncClear?.();
            B.Xml.domToWorkspace(dom, B.derivWorkspace);
            B.derivWorkspace.strategy_to_load = xml;
            B.svgResize?.(B.derivWorkspace);
            try { B.derivWorkspace.scrollCenter?.(); } catch {}
            return true;
        } catch { return false; }
    }, [store]);

    const autoRun = useCallback(async () => {
        const rp: any = store?.run_panel;
        if (!rp?.onRunButtonClick) return;
        for (let i = 0; i < 6; i++) {
            try { if (!rp.is_running) { await rp.onRunButtonClick(); return; } }
            catch { if (i < 5) await new Promise(r => setTimeout(r, 500)); }
        }
    }, [store]);

    const handleLoadXml = useCallback(async (bot: TScalperBot) => {
        try {
            const res = await fetch(bot.xmlFile);
            if (!res.ok) throw new Error();
            const xml = await res.text();
            store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
            store?.run_panel?.toggleDrawer?.(true);
            let ok = await loadXmlIntoWorkspace(xml, bot.name);
            if (!ok) {
                ok = await new Promise<boolean>(resolve => {
                    let n = 0;
                    const poll = setInterval(async () => {
                        n++;
                        const r = await loadXmlIntoWorkspace(xml, bot.name);
                        if (r || n >= 50) { clearInterval(poll); resolve(r); }
                    }, 100);
                });
            }
        } catch { store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING); }
    }, [store, loadXmlIntoWorkspace]);

    const handleLoadAndRun = useCallback(async (bot: TScalperBot) => {
        await handleLoadXml(bot);
        setTimeout(() => autoRun(), 900);
    }, [handleLoadXml, autoRun]);

    /* Silently sync the Bot Builder workspace with this bot's default XML — no tab
       switch, no UI disruption — used automatically whenever the terminal Run button
       is pressed so "Run" always has the matching XML strategy loaded. */
    const handlePreloadXml = useCallback(async (bot: TScalperBot) => {
        try {
            const res = await fetch(bot.xmlFile);
            if (!res.ok) return;
            const xml = await res.text();
            await loadXmlIntoWorkspace(xml, bot.name);
        } catch { /* non-fatal — terminal engine trades independently of the workspace */ }
    }, [loadXmlIntoWorkspace]);

    if (selectedBot) {
        return (
            <BotDetail
                bot={selectedBot}
                derivTrade={derivTrade}
                onBack={() => setSelectedBot(null)}
                onLoadXml={handleLoadXml}
                onLoadAndRun={handleLoadAndRun}
                onPreloadXml={handlePreloadXml}
            />
        );
    }

    return (
        <div className='scalper-bots'>
            <div className='scalper-bots__header'>
                <div className='scalper-bots__header-left'>
                    <h1>⚡ <span>AHMED SCALPER BOTS</span></h1>
                    <p>{SCALPER_BOTS.length} strategies · Click a card to configure &amp; run</p>
                </div>
                <div className='scalper-bots__header-right'>
                    <AccountBadge />
                    <div className={`scalper-bots__conn ${derivTrade.authorized ? 'on' : 'off'}`}>
                        <span>{derivTrade.authorized ? '● LIVE' : '○ Offline'}</span>
                    </div>
                    {derivTrade.balance !== null && (
                        <div className='scalper-bots__balance'>
                            {derivTrade.currency} {derivTrade.balance.toFixed(2)}
                        </div>
                    )}
                </div>
            </div>

            <div className='scalper-bots__filters'>
                <div className='scalper-bots__search-box'>
                    <span>🔍</span>
                    <input type='text' placeholder='Search scalpers...' value={search}
                        onChange={e => setSearch(e.target.value)} />
                </div>
                {CATEGORIES.map(cat => (
                    <button key={cat}
                        className={`scalper-bots__filter-btn ${category === cat ? 'active' : ''}`}
                        onClick={() => setCategory(cat)}>
                        {cat}
                    </button>
                ))}
                <span className='scalper-bots__count'>{filtered.length} bots</span>
            </div>

            <div className='scalper-bots__grid'>
                {filtered.map(bot => (
                    <div key={bot.key} className='sb-card' onClick={() => setSelectedBot(bot)}>
                        <div className='sb-card__icon'>
                            {bot.contractType.includes('EVEN') ? '2️⃣' : bot.contractType.includes('ODD') ? '1️⃣' : bot.contractType.includes('OVER') ? '⬆️' : '⬇️'}
                        </div>
                        <div className='sb-card__name'>{bot.name}</div>
                        <div className='sb-card__tags'>
                            <span className='sb-card__tag'>{bot.contractType}</span>
                            {bot.prediction !== null && <span className='sb-card__tag'>▸{bot.prediction}</span>}
                            <span className={`sb-card__tag ${bot.multiple ? 'multi' : 'single'}`}>
                                {bot.multiple ? 'MULTI' : 'SINGLE'}
                            </span>
                        </div>
                        <button className='sb-card__open'>Configure &amp; Run →</button>
                    </div>
                ))}
            </div>
        </div>
    );
});

export default ScalperBots;
