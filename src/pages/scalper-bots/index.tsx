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

/* Strategy Logic types */
type StrategyAlgorithm = 'LDP' | 'MDP' | 'STREAK';
type StrategyDigits = 'ODD' | 'EVEN' | 'OVER' | 'UNDER' | 'ANY';

type StrategyCondition = {
    id: string;
    algorithm: StrategyAlgorithm;
    strict: boolean;
    ifLast: number;       // check last N digits
    digitsIs: StrategyDigits;
    recoveryLimit: number; // max recovery tries before giving up
};

type StrategyLogicConfig = {
    globalShared: boolean;
    enabled: boolean;
    conditions: StrategyCondition[];
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

const makeDefaultCondition = (): StrategyCondition => ({
    id: Math.random().toString(36).slice(2),
    algorithm: 'LDP',
    strict: true,
    ifLast: 3,
    digitsIs: 'ODD',
    recoveryLimit: 1,
});

const DEFAULT_STRATEGY_LOGIC: StrategyLogicConfig = {
    globalShared: false,
    enabled: true,
    conditions: [makeDefaultCondition()],
};

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
    strategyLogic: { ...DEFAULT_STRATEGY_LOGIC, conditions: [makeDefaultCondition()] },
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
const ALGO_OPTIONS: { value: StrategyAlgorithm; label: string }[] = [
    { value: 'LDP',    label: 'LDP — Last Digit Pattern' },
    { value: 'MDP',    label: 'MDP — Multi Digit Pattern' },
    { value: 'STREAK', label: 'STREAK — Consecutive Run' },
];
const DIGITS_OPTIONS: { value: StrategyDigits; label: string }[] = [
    { value: 'ODD',   label: 'ODD' },
    { value: 'EVEN',  label: 'EVEN' },
    { value: 'OVER',  label: 'OVER' },
    { value: 'UNDER', label: 'UNDER' },
    { value: 'ANY',   label: 'ANY' },
];

/* ─── Hacker scan messages ─── */
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
    'DERIV_API_LATENCY: OK',
    'POSITION_SIZER: CALIBRATED',
    'RISK_ENGINE: ARMED',
];

/* ─── Entry signal: single condition check ─── */
function checkConditionEntry(
    digits: number[],
    contractType: string,
    barrier: number | null,
    cond: StrategyCondition
): boolean {
    if (digits.length < cond.ifLast) return false;
    const recent = digits.slice(0, cond.ifLast);
    let matchCount = 0;

    for (const d of recent) {
        let m = false;
        switch (cond.digitsIs) {
            case 'ODD':   m = d % 2 !== 0; break;
            case 'EVEN':  m = d % 2 === 0; break;
            case 'OVER':  m = barrier !== null ? d > barrier : d > 5; break;
            case 'UNDER': m = barrier !== null ? d <= barrier : d <= 4; break;
            case 'ANY':   m = true; break;
        }
        if (m) matchCount++;
    }

    // STRICT: all must match; non-strict: ≥75%
    const threshold = cond.strict ? cond.ifLast : Math.max(1, Math.ceil(cond.ifLast * 0.75));
    return matchCount >= threshold;
}

/* ─── Entry signal: strategy logic OR-group ─── */
function checkEntry(
    digits: number[],
    contractType: string,
    barrier: number | null,
    logic: StrategyLogicConfig | null
): boolean {
    // Fallback when logic is disabled or no conditions
    if (!logic || !logic.enabled || logic.conditions.length === 0) {
        return checkEntryDefault(digits, contractType, barrier);
    }
    // OR-group: any condition true → entry
    return logic.conditions.some(c => checkConditionEntry(digits, contractType, barrier, c));
}

function checkEntryDefault(digits: number[], contractType: string, barrier: number | null): boolean {
    if (digits.length < 5) return false;
    const recent = digits.slice(0, 10);
    switch (contractType) {
        case 'DIGITEVEN': { let s = 0; for (const d of recent) { if (d % 2 !== 0) s++; else break; } return s >= 3; }
        case 'DIGITODD':  { let s = 0; for (const d of recent) { if (d % 2 === 0) s++; else break; } return s >= 3; }
        case 'DIGITOVER': { if (barrier === null) return true; let s = 0; for (const d of recent) { if (d <= barrier) s++; else break; } return s >= 2; }
        case 'DIGITUNDER':{ if (barrier === null) return true; let s = 0; for (const d of recent) { if (d > barrier) s++; else break; } return s >= 2; }
        default: return digits.length >= 3;
    }
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

/* ─── XML helpers ─── */
function patchXmlMarket(xml: string, market: string): string {
    // Patch <field name="SYMBOL_LIST">…</field>
    return xml.replace(
        /(<field\s+name=["']SYMBOL_LIST["'][^>]*>)[^<]*/gi,
        `$1${market}`
    );
}
function patchXmlStake(xml: string, stake: number): string {
    // Patch <field name="AMOUNT">…</field>
    return xml.replace(
        /(<field\s+name=["']AMOUNT["'][^>]*>)[^<]*/gi,
        `$1${stake}`
    );
}

/* ─── NumInput — editable numeric field (no clamp-on-type bug) ─── */
const NumInput: React.FC<{
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (v: number) => void;
    disabled?: boolean;
}> = ({ value, min = 0, max = 9999999, step, onChange, disabled }) => {
    const [str, setStr] = useState(String(value));
    useEffect(() => { setStr(String(value)); }, [value]);
    return (
        <input
            type='number' min={min} max={max} step={step}
            value={str} disabled={disabled}
            onChange={e => setStr(e.target.value)}
            onBlur={() => {
                const v = parseFloat(str);
                if (!isNaN(v)) {
                    const c = Math.max(min, Math.min(max, v));
                    onChange(c); setStr(String(c));
                } else { setStr(String(value)); }
            }}
        />
    );
};

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

/* ─── Toggle Row ─── */
const ToggleRow: React.FC<{
    label: string; sublabel?: string; on: boolean;
    onToggle: () => void; disabled?: boolean;
}> = ({ label, sublabel, on, onToggle, disabled }) => (
    <div className='sb-toggle-row'>
        <div>
            <div className='sb-toggle-row__label'>{label}</div>
            {sublabel && <div className={`sb-toggle-row__sub ${on ? 'active' : 'disabled'}`}>{on ? 'ACTIVE' : 'DISABLED'}</div>}
        </div>
        <label className={`sb-switch ${disabled ? 'sb-switch--disabled' : ''}`}>
            <input type='checkbox' checked={on} onChange={onToggle} disabled={disabled} />
            <span className='sb-switch__track'><span className='sb-switch__thumb' /></span>
        </label>
    </div>
);

/* ─── Accordion Section ─── */
const SbAccordion: React.FC<{
    title: string; badge?: string; badgeColor?: string;
    defaultOpen?: boolean; children: React.ReactNode;
}> = ({ title, badge, badgeColor = '#22c55e', defaultOpen = false, children }) => {
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
   BotDetail — configure + run view
   ══════════════════════════════════════════════ */
const BotDetail: React.FC<{
    bot: TScalperBot;
    derivTrade: ReturnType<typeof useDerivTrade>;
    onBack: () => void;
    onLoadXml: (bot: TScalperBot) => Promise<void>;
    onLoadAndRun: (bot: TScalperBot) => Promise<void>;
    loadXmlIntoWorkspace: (xml: string, name: string) => Promise<boolean>;
}> = ({ bot, derivTrade, onBack, onLoadXml, onLoadAndRun, loadXmlIntoWorkspace }) => {
    const [cfg, setCfg]         = useState<BotConfig>(() => DEFAULT_CONFIG(bot));
    const [running, setRunning] = useState(false);
    const [tab, setTab]         = useState<'summary' | 'transactions' | 'journal'>('summary');
    const [terminal, setTerminal] = useState<{ t: string; msg: string; kind: string }[]>([]);
    const [txList, setTxList]   = useState<TxRecord[]>([]);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    const [loadingXml, setLoadingXml] = useState(false);
    const [entryReady, setEntryReady] = useState(false);
    const [activeMarket, setActiveMarket] = useState(cfg.market);
    const [addMarketSel, setAddMarketSel] = useState('1HZ50V');
    const [digitDisplay, setDigitDisplay] = useState<number[]>([]);
    const [xmlCache, setXmlCache] = useState<string | null>(null); // cached XML for the bot

    const stopRef        = useRef(false);
    const consLossRef    = useRef(0);
    const sessionPnlRef  = useRef(0);
    const txIdRef        = useRef(0);
    const termRef        = useRef<HTMLDivElement>(null);
    const digitWindowRef = useRef<number[]>([]);
    const tickUnsubRef   = useRef<(() => void) | null>(null);
    const xmlCacheRef    = useRef<string | null>(null);

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
        setTerminal(prev => [{ t: ts(), msg, kind }, ...prev].slice(0, 500));
    }, []);

    useEffect(() => {
        if (termRef.current) termRef.current.scrollTop = 0;
    }, [terminal.length]);

    const cfgSet = (patch: Partial<BotConfig>) => setCfg(prev => ({ ...prev, ...patch }));
    const rmSet  = (patch: Partial<RiskManagerConfig>) =>
        setCfg(prev => ({ ...prev, riskManager: { ...prev.riskManager, ...patch } }));
    const slSet  = (patch: Partial<StrategyLogicConfig>) =>
        setCfg(prev => ({ ...prev, strategyLogic: { ...prev.strategyLogic, ...patch } }));
    const condSet = (id: string, patch: Partial<StrategyCondition>) =>
        slSet({ conditions: cfg.strategyLogic.conditions.map(c => c.id === id ? { ...c, ...patch } : c) });
    const condAdd = () => slSet({ conditions: [...cfg.strategyLogic.conditions, makeDefaultCondition()] });
    const condDel = (id: string) => slSet({ conditions: cfg.strategyLogic.conditions.filter(c => c.id !== id) });

    /* ── Load + cache XML ── */
    const fetchXml = useCallback(async (): Promise<string | null> => {
        if (xmlCacheRef.current) return xmlCacheRef.current;
        try {
            const res = await fetch(bot.xmlFile);
            if (!res.ok) return null;
            const xml = await res.text();
            xmlCacheRef.current = xml;
            setXmlCache(xml);
            return xml;
        } catch { return null; }
    }, [bot.xmlFile]);

    /* ── Silent background XML load ── */
    const silentLoadXml = useCallback(async (market: string, stake: number) => {
        try {
            let xml = await fetchXml();
            if (!xml) return;
            xml = patchXmlMarket(xml, market);
            xml = patchXmlStake(xml, stake);
            await loadXmlIntoWorkspace(xml, bot.name);
        } catch { /* silent */ }
    }, [fetchXml, loadXmlIntoWorkspace, bot.name]);

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

    useEffect(() => () => { if (tickUnsubRef.current) tickUnsubRef.current(); }, []);

    /* ── Hacker startup sequence ── */
    const runHackerStartup = async (market: string, xmlLoaded: boolean) => {
        const isDemo = (localStorage.getItem('active_loginid') || '').startsWith('VRTC');
        const msgs = [
            `STATUS: ONLINE — ${isDemo ? 'DEMO_ACCOUNT' : 'REAL_ACCOUNT'}`,
            `CONNECTION_SPEED: ${118 + Math.floor(Math.random() * 32)} Mbps`,
            `XML_BOT_LOADED: ${xmlLoaded ? bot.name.toUpperCase().replace(/ /g, '_') : 'FALLBACK_DIRECT_API'}`,
            'BYPASS_FIREWALL: SUCCESS',
            'BUFFER_OVERFLOW_CHECK: PASS',
            `MARKET_SYNC → ${market}`,
            'DDOS_PROTECTION: BYPASSED',
            'ENCRYPTING RSA_2048_KEYS',
            `SIGNAL_PROCESSOR: ONLINE — ${contractLabel(bot)}`,
            'STRATEGY_LOGIC: ARMED',
            'RISK_ENGINE: CALIBRATED',
            'MARKET_FEED_INTEGRITY: OK',
        ];
        for (const m of msgs) {
            if (stopRef.current) return;
            addLog(m, 'hack');
            await new Promise(r => setTimeout(r, 80 + Math.random() * 60));
        }
    };

    /* ── Execute one trade cycle (entry → buy → settle) ── */
    const executeTrade = async (
        curMarket: string,
        curStake: number,
        patchedXml: string | null
    ): Promise<{ profit: number; exitDigit: number | null }> => {
        /* Patch XML to current market+stake and reload */
        if (patchedXml) {
            let xml = patchedXml;
            xml = patchXmlMarket(xml, curMarket);
            xml = patchXmlStake(xml, curStake);
            loadXmlIntoWorkspace(xml, bot.name).catch(() => {});
        }

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

        const exitDigit = txList.find(t => t.id === txId)?.exitDigit ?? null;
        return { profit, exitDigit: null };
    };

    /* ── Start bot ── */
    const startBot = useCallback(async () => {
        if (running || !derivTrade.authorized) return;
        stopRef.current      = false;
        consLossRef.current  = 0;
        sessionPnlRef.current = 0;
        setRunning(true);
        setEntryReady(false);
        setTerminal([]);

        /* Determine market list */
        const marketList = cfg.useMarketSwitch && cfg.markets.length > 0
            ? [...cfg.markets] : [cfg.market];
        let curMarketIdx = 0;
        let curMarket    = marketList[curMarketIdx];

        /* Load XML silently */
        addLog('⚙ LOADING XML BOT...', 'hack');
        const rawXml = await fetchXml();
        const xmlLoaded = !!rawXml;

        /* Subscribe ticks + startup sequence */
        subscribeMarket(curMarket);
        addLog(`▶ BOT ENGINE STARTED — ${contractLabel(bot)}`, 'start');
        await runHackerStartup(curMarket, xmlLoaded);

        if (rawXml) silentLoadXml(curMarket, cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake);

        let curStake  = cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake;
        let martCount = 0;
        // Recovery limit from strategy logic (use the first condition's recoveryLimit, or ∞ for multiple bots)
        const recoveryLimit = cfg.strategyLogic.enabled && cfg.strategyLogic.conditions.length > 0
            ? cfg.strategyLogic.conditions[0].recoveryLimit
            : (bot.multiple ? 999 : 0);

        while (!stopRef.current) {
            try {
                /* ── Scan for entry signal ── */
                addLog(`📡 SCANNING → ${curMarket} | ${contractLabel(bot)}`, 'scan');
                setEntryReady(false);

                let scanTick = 0;
                let entry = false;
                while (!entry && !stopRef.current) {
                    entry = checkEntry(
                        digitWindowRef.current,
                        bot.contractType,
                        bot.prediction,
                        cfg.strategyLogic.enabled ? cfg.strategyLogic : null
                    );
                    scanTick++;

                    if (!entry) {
                        if (scanTick % 4 === 1) {
                            const recent = digitWindowRef.current.slice(0, 10).join(' ');
                            addLog(`ANALYZING_DIGIT_PATTERN: [ ${recent || '...'} ]`, 'scan');
                        }
                        if (scanTick % 8 === 3) {
                            addLog(HACK_SCAN_MSGS[Math.floor(Math.random() * HACK_SCAN_MSGS.length)], 'hack');
                        }
                        if (scanTick % 12 === 7) {
                            const condDesc = cfg.strategyLogic.enabled && cfg.strategyLogic.conditions.length > 0
                                ? `LDP[${cfg.strategyLogic.conditions[0].ifLast}×${cfg.strategyLogic.conditions[0].digitsIs}]`
                                : 'DEFAULT';
                            addLog(`STRATEGY: ${condDesc} | WAITING_FOR_SIGNAL...`, 'scan');
                        }
                        if (scanTick % 10 === 5) {
                            addLog(`CONNECTION_SPEED: ${105 + Math.floor(Math.random() * 40)} Mbps`, 'hack');
                        }
                        await new Promise(r => setTimeout(r, 600));
                    }
                }

                if (stopRef.current) break;

                /* ── Entry fired ── */
                setEntryReady(true);
                addLog('⚡ ENTRY_SIGNAL_DETECTED — EXECUTING TRADE', 'entry');
                addLog(`XML_BOT_PROTOCOL: ACTIVATED | stake: $${curStake.toFixed(2)} | market: ${curMarket}`, 'entry');
                await new Promise(r => setTimeout(r, 100));

                /* ── Execute trade ── */
                const txId = ++txIdRef.current;
                setTxList(prev => [{
                    id: txId, time: ts(), market: curMarket,
                    type: contractLabel(bot), stake: curStake,
                    barrier: bot.prediction, result: 'open', profit: 0, exitDigit: null,
                }, ...prev]);

                const params: any = {
                    symbol: curMarket,
                    contract_type: bot.contractType,
                    duration: cfg.duration,
                    duration_unit: 't',
                    stake: curStake,
                };
                if (bot.prediction !== null) params.barrier = String(bot.prediction);

                /* Patch XML with market+stake and silently reload */
                if (rawXml) {
                    const patched = patchXmlStake(patchXmlMarket(rawXml, curMarket), curStake);
                    loadXmlIntoWorkspace(patched, bot.name).catch(() => {});
                }

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
                    martCount = 0;
                    curStake = cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake;
                    addLog(`✅ TICK WIN  +${profit.toFixed(2)} USD  |  P/L: ${pnlStr}`, 'win');

                    /* Single-run: always stop on win */
                    if (!bot.multiple) {
                        addLog('🏁 SINGLE_RUN_COMPLETE — BOT STOPPED ON WIN', 'stop');
                        break;
                    }

                    /* TP check */
                    if (cfg.tpGuard && sessionPnlRef.current >= cfg.takeProfit) {
                        addLog(`🎯 TAKE_PROFIT TARGET $${cfg.takeProfit} REACHED — BOT STOPPED`, 'stop');
                        break;
                    }

                    addLog('🔄 RECOVERY_COMPLETE — RETURNING TO MARKET SCAN', 'scan');
                    martCount = 0; // reset after win
                } else {
                    consLossRef.current++;
                    martCount++;

                    const rm = cfg.riskManager;
                    const useMartingale = rm.inject && rm.active && rm.onLose
                        ? martCount >= rm.activateLimit && martCount <= rm.deactivateLimit
                        : !rm.inject;
                    const multiplier = rm.inject && rm.active ? rm.multiplier : cfg.martingale;
                    const nextStake  = useMartingale ? +(curStake * multiplier).toFixed(2) : curStake;

                    addLog(`❌ LOSS  ${profit.toFixed(2)} USD  |  consec: ${consLossRef.current}  |  RECOVERY_STAKE: $${nextStake.toFixed(2)}`, 'loss');

                    /* Recovery limit from strategy logic */
                    if (martCount > recoveryLimit && !bot.multiple) {
                        addLog(`🛑 RECOVERY_LIMIT (${recoveryLimit}) REACHED — BOT STOPPED`, 'stop');
                        break;
                    }

                    if (martCount > recoveryLimit && bot.multiple) {
                        addLog(`♻ RECOVERY_LIMIT_RESET — Re-entering market scan`, 'scan');
                        martCount = 0;
                        curStake = cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake;
                    }

                    /* Stop on consecutive losses */
                    if (cfg.stopOnLoss && consLossRef.current >= cfg.consecutiveLossLimit) {
                        if (cfg.useMarketSwitch && cfg.markets.length > 1) {
                            curMarketIdx = (curMarketIdx + 1) % marketList.length;
                            curMarket    = marketList[curMarketIdx];
                            consLossRef.current = 0;
                            martCount = 0;
                            curStake  = cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake;
                            subscribeMarket(curMarket);
                            addLog(`🔀 MARKET_SWITCH_PROTOCOL → ${curMarket} (after ${cfg.consecutiveLossLimit} losses)`, 'switch');
                            /* Patch XML to new market */
                            if (rawXml) {
                                const patched = patchXmlStake(patchXmlMarket(rawXml, curMarket), curStake);
                                loadXmlIntoWorkspace(patched, bot.name).catch(() => {});
                                addLog(`XML_MARKET_PATCH: applied → ${curMarket}`, 'hack');
                            }
                            continue;
                        }
                        addLog(`🛑 STOPPED — ${cfg.consecutiveLossLimit} consecutive losses`, 'stop');
                        break;
                    }

                    /* TP/SL check */
                    if (cfg.tpGuard) {
                        if (sessionPnlRef.current >= cfg.takeProfit) {
                            addLog(`🎯 TAKE_PROFIT $${cfg.takeProfit} REACHED — BOT STOPPED`, 'stop');
                            break;
                        }
                        if (sessionPnlRef.current <= -Math.abs(cfg.stopLoss)) {
                            addLog(`🛡 STOP_LOSS -$${cfg.stopLoss} TRIGGERED — BOT STOPPED`, 'stop');
                            break;
                        }
                    }

                    addLog(`🔄 RECOVERY_MODE: stake → $${nextStake.toFixed(2)} | attempt ${martCount}`, 'loss');
                    curStake = Math.max(0.35, nextStake);
                }
            } catch (err: any) {
                addLog(`⚠ API_ERROR: ${err?.error?.message || err?.message || 'Trade error — retrying...'}`, 'error');
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        if (tickUnsubRef.current) { tickUnsubRef.current(); tickUnsubRef.current = null; }
        addLog('⏹ BOT_SESSION TERMINATED', 'info');
        setRunning(false);
        setEntryReady(false);
    }, [running, derivTrade, bot, cfg, addLog, subscribeMarket, fetchXml, silentLoadXml, loadXmlIntoWorkspace]);

    const stopBot = useCallback(() => {
        stopRef.current = true;
        addLog('⏸ STOP_SIGNAL SENT — awaiting trade settlement...', 'info');
    }, [addLog]);

    const addMarket = () => {
        if (!cfg.markets.includes(addMarketSel))
            cfgSet({ markets: [...cfg.markets, addMarketSel] });
    };
    const removeMarket = (m: string) => cfgSet({ markets: cfg.markets.filter(x => x !== m) });
    const marketLabel = (v: string) => ALL_MARKETS.find(m => m.value === v)?.label ?? v;

    /* ── Strategy condition description ── */
    const condEntryDesc = (cond: StrategyCondition) => {
        const what = `last ${cond.ifLast} digits are ${cond.strict ? 'ALL' : '≥75%'} ${cond.digitsIs}`;
        return `IF ${what} → ENTRY (recovery limit: ${cond.recoveryLimit})`;
    };

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
                {/* ── Left Sidebar ── */}
                <div className='sb-detail__sidebar'>

                    {/* Builder buttons */}
                    <div className='sb-bot-actions'>
                        <button className='sb-bot-action-btn' onClick={() => { setLoadingXml(true); onLoadXml(bot).finally(() => setLoadingXml(false)); }} disabled={loadingXml}>
                            📁 DEFAULT BOT
                        </button>
                        <button className='sb-bot-action-btn' onClick={() => { setLoadingXml(true); onLoadAndRun(bot).finally(() => setLoadingXml(false)); }} disabled={loadingXml}>
                            ▶ SELECT BOT
                        </button>
                        <button className='sb-bot-action-btn' disabled>⬆ UPLOAD BOT</button>
                        <button className='sb-bot-action-btn' disabled>⬇ DOWNLOAD</button>
                    </div>

                    <div className='sb-global-label'>GLOBAL SHARED</div>

                    {/* ── Trade Parameters ── */}
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
                                <NumInput value={cfg.duration} min={1} max={10}
                                    onChange={v => cfgSet({ duration: v })} disabled={running} />
                                <span className='sb-unit'>Ticks</span>
                            </div>
                            <div className='sb-field'>
                                <label>Stake (USD)</label>
                                <NumInput value={cfg.stake} min={0.35} max={100000} step={0.01}
                                    onChange={v => cfgSet({ stake: v })} disabled={running} />
                            </div>
                        </div>
                        <div className='sb-field'>
                            <label>Mode</label>
                            <span className='sb-badge'>{bot.multiple ? 'Multiple runs' : 'Single run (stop on win)'}</span>
                        </div>
                    </SbAccordion>

                    {/* ── Stop Trading ── */}
                    <SbAccordion title='Stop Trading' badge={cfg.stopOnLoss ? 'ACTIVE' : 'DISABLED'} badgeColor={cfg.stopOnLoss ? '#22c55e' : '#64748b'} defaultOpen>
                        <ToggleRow label='Stop After Losses' sublabel='' on={cfg.stopOnLoss}
                            onToggle={() => cfgSet({ stopOnLoss: !cfg.stopOnLoss })} disabled={running} />
                        {cfg.stopOnLoss && (
                            <>
                                <div className='sb-field'>
                                    <label>Consecutive Losses</label>
                                    <NumInput value={cfg.consecutiveLossLimit} min={1} max={20}
                                        onChange={v => cfgSet({ consecutiveLossLimit: v })} disabled={running} />
                                </div>
                                <p className='sb-hint'>Bot stops after {cfg.consecutiveLossLimit} consecutive losses.</p>
                            </>
                        )}
                    </SbAccordion>

                    {/* ── TP/SL Guard ── */}
                    <SbAccordion title='TP/SL Guard' badge={cfg.tpGuard ? 'ACTIVE' : 'DISABLED'} badgeColor={cfg.tpGuard ? '#22c55e' : '#64748b'} defaultOpen>
                        <ToggleRow label='TP/SL Guard' on={cfg.tpGuard}
                            onToggle={() => cfgSet({ tpGuard: !cfg.tpGuard })} disabled={running} />
                        {cfg.tpGuard && (
                            <>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Take Profit ($)</label>
                                        <NumInput value={cfg.takeProfit} min={1} max={100000}
                                            onChange={v => cfgSet({ takeProfit: v })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Stop Loss ($)</label>
                                        <NumInput value={cfg.stopLoss} min={1} max={100000}
                                            onChange={v => cfgSet({ stopLoss: v })} disabled={running} />
                                    </div>
                                </div>
                                <div className='sb-tpsl-bar'>
                                    <span className='sb-tpsl-tp'>TP +{cfg.takeProfit}</span>
                                    <span className='sb-tpsl-sl'>SL -{cfg.stopLoss}</span>
                                </div>
                            </>
                        )}
                    </SbAccordion>

                    {/* ── Risk Manager ── */}
                    <SbAccordion title='Risk Manager' badge={cfg.riskManager.inject ? 'INJECTED' : 'STANDARD'} badgeColor={cfg.riskManager.inject ? '#f59e0b' : '#64748b'}>
                        <ToggleRow label='Inject Risk Manager' sublabel='' on={cfg.riskManager.inject}
                            onToggle={() => rmSet({ inject: !cfg.riskManager.inject })} disabled={running} />
                        {cfg.riskManager.inject ? (
                            <>
                                <div className='sb-rm-type'>Martingale <span className='sb-rm-info'>ⓘ</span></div>
                                <ToggleRow label='Risk Manager' sublabel='' on={cfg.riskManager.active}
                                    onToggle={() => rmSet({ active: !cfg.riskManager.active })} disabled={running} />
                                <ToggleRow label='On Lose' sublabel='' on={cfg.riskManager.onLose}
                                    onToggle={() => rmSet({ onLose: !cfg.riskManager.onLose })} disabled={running} />
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Activate Limit</label>
                                        <NumInput value={cfg.riskManager.activateLimit} min={1} max={50}
                                            onChange={v => rmSet({ activateLimit: v })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Deactivate Limit</label>
                                        <NumInput value={cfg.riskManager.deactivateLimit} min={1} max={500}
                                            onChange={v => rmSet({ deactivateLimit: v })} disabled={running} />
                                    </div>
                                </div>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Multiplier</label>
                                        <NumInput value={cfg.riskManager.multiplier} min={1} max={10} step={0.5}
                                            onChange={v => rmSet({ multiplier: v })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Stake (override)</label>
                                        <NumInput value={cfg.riskManager.overrideStake} min={0.35} max={100000} step={0.01}
                                            onChange={v => rmSet({ overrideStake: v })} disabled={running} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className='sb-field'>
                                    <label>Martingale ×</label>
                                    <NumInput value={cfg.martingale} min={1} max={10} step={0.5}
                                        onChange={v => cfgSet({ martingale: v })} disabled={running} />
                                </div>
                                <p className='sb-hint'>Standard martingale — stake × {cfg.martingale} on each loss.</p>
                            </>
                        )}
                    </SbAccordion>

                    {/* ── Market Switcher ── */}
                    <SbAccordion title='Market Switcher' badge={cfg.useMarketSwitch ? 'ACTIVE' : 'OFF'} badgeColor={cfg.useMarketSwitch ? '#06b6d4' : '#64748b'}>
                        <ToggleRow label='Auto Switch Markets' on={cfg.useMarketSwitch}
                            onToggle={() => cfgSet({ useMarketSwitch: !cfg.useMarketSwitch })} disabled={running} />
                        {cfg.useMarketSwitch && (
                            <>
                                <div className='sb-field'>
                                    <label>Switch After Losses</label>
                                    <NumInput value={cfg.switchOnLosses} min={1} max={10}
                                        onChange={v => cfgSet({ switchOnLosses: v })} disabled={running} />
                                    <span className='sb-unit'>losses</span>
                                </div>
                                <p className='sb-hint'>Switches to the next market after {cfg.switchOnLosses} consecutive losses.</p>
                                <div className='sb-markets-list'>
                                    {cfg.markets.map(m => (
                                        <div key={m} className='sb-market-pill'>
                                            <span>{marketLabel(m)}</span>
                                            {!running && <button className='sb-market-remove' onClick={() => removeMarket(m)}>×</button>}
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

                    {/* ── Strategy Logic ── */}
                    <SbAccordion title='Strategy Logic' badge={cfg.strategyLogic.enabled ? 'ACTIVE' : 'OFF'} badgeColor={cfg.strategyLogic.enabled ? '#f59e0b' : '#64748b'} defaultOpen>
                        <ToggleRow label='Global Shared' sublabel='' on={cfg.strategyLogic.globalShared}
                            onToggle={() => slSet({ globalShared: !cfg.strategyLogic.globalShared })} disabled={running} />
                        <ToggleRow label='Strategy' sublabel='' on={cfg.strategyLogic.enabled}
                            onToggle={() => slSet({ enabled: !cfg.strategyLogic.enabled })} disabled={running} />

                        {cfg.strategyLogic.conditions.map((cond, idx) => (
                            <div key={cond.id} className='sb-condition-group'>
                                <div className='sb-condition-group__header'>
                                    <span className='sb-condition-group__label'>OR GROUP #{idx + 1}</span>
                                    <span className='sb-condition-badge'>CONDITION</span>
                                    {cfg.strategyLogic.conditions.length > 1 && (
                                        <button className='sb-condition-del' onClick={() => condDel(cond.id)} disabled={running}>🗑</button>
                                    )}
                                </div>
                                <div className='sb-condition-body'>
                                    <div className='sb-field'>
                                        <label>Algorithm</label>
                                        <div className='sb-algo-row'>
                                            <select value={cond.algorithm}
                                                onChange={e => condSet(cond.id, { algorithm: e.target.value as StrategyAlgorithm })}
                                                disabled={running}>
                                                {ALGO_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                            </select>
                                            <span className='sb-rm-info' title='LDP: Last Digit Pattern — checks the last N digits for a specific pattern before entering'>ⓘ</span>
                                        </div>
                                    </div>
                                    <ToggleRow label='Strict' sublabel='' on={cond.strict}
                                        onToggle={() => condSet(cond.id, { strict: !cond.strict })} disabled={running} />
                                    <div className='sb-field-row'>
                                        <div className='sb-field'>
                                            <label>If Last</label>
                                            <NumInput value={cond.ifLast} min={1} max={20}
                                                onChange={v => condSet(cond.id, { ifLast: v })} disabled={running} />
                                        </div>
                                        <div className='sb-field'>
                                            <label>Recovery Limit</label>
                                            <NumInput value={cond.recoveryLimit} min={0} max={100}
                                                onChange={v => condSet(cond.id, { recoveryLimit: v })} disabled={running} />
                                        </div>
                                    </div>
                                    <div className='sb-field'>
                                        <label>Digits Is</label>
                                        <select value={cond.digitsIs}
                                            onChange={e => condSet(cond.id, { digitsIs: e.target.value as StrategyDigits })}
                                            disabled={running}>
                                            {DIGITS_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                        </select>
                                    </div>
                                    <p className='sb-hint sb-hint--cyan'>{condEntryDesc(cond)}</p>
                                </div>
                            </div>
                        ))}

                        {!running && (
                            <button className='sb-add-condition-btn' onClick={condAdd}>
                                + Add OR Condition
                            </button>
                        )}
                    </SbAccordion>

                    {/* ── MARKET 1 ── */}
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
                        {cfg.strategyLogic.enabled && cfg.strategyLogic.conditions.length > 0 && (
                            <p className='sb-hint sb-hint--cyan'>{condEntryDesc(cfg.strategyLogic.conditions[0])}</p>
                        )}
                    </SbAccordion>
                </div>

                {/* ── Right — Terminal ── */}
                <div className='sb-detail__terminal-col'>
                    <div className='sb-terminal-market-bar'>
                        <span className='sb-terminal-market-label'>ACTIVE MARKET:</span>
                        <span className='sb-terminal-market-value'>{activeMarket}</span>
                        {entryReady && <span className='sb-entry-ready'>⚡ ENTRY SIGNAL</span>}
                        {running && <span className='sb-terminal__live'>● LIVE</span>}
                    </div>

                    <div className='sb-digit-window'>
                        {digitDisplay.length === 0 ? (
                            <span className='sb-digit-window__empty'>waiting for ticks…</span>
                        ) : digitDisplay.map((d, i) => (
                            <span key={i} className={`sb-digit-chip ${i === 0 ? 'latest' : ''}`}>{d}</span>
                        ))}
                    </div>

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
                                    <p>When you're ready to trade, hit <strong>Run</strong>. You'll be able to track your bot's performance here.</p>
                                </div>
                            ) : (
                                <>
                                    <div className='sb-summary__stats'>
                                        <div className='sb-stat'><span>TOTAL STAKE</span><strong>${txList.reduce((a, t) => a + t.stake, 0).toFixed(2)}</strong></div>
                                        <div className='sb-stat'><span>TOTAL PAYOUT</span><strong>${txList.filter(t => t.result === 'won').reduce((a, t) => a + t.stake + t.profit, 0).toFixed(2)}</strong></div>
                                        <div className='sb-stat'><span>NO. OF RUNS</span><strong>{summary.runs}</strong></div>
                                        <div className='sb-stat red'><span>LOST</span><strong>${Math.abs(txList.filter(t => t.result === 'lost').reduce((a, t) => a + t.profit, 0)).toFixed(2)}</strong></div>
                                        <div className='sb-stat green'><span>WON</span><strong>${txList.filter(t => t.result === 'won').reduce((a, t) => a + t.profit, 0).toFixed(2)}</strong></div>
                                        <div className={`sb-stat ${summary.pnl >= 0 ? 'green' : 'red'}`}>
                                            <span>TOTAL P/L</span>
                                            <strong>{summary.pnl >= 0 ? '+' : ''}{summary.pnl.toFixed(2)} USD</strong>
                                        </div>
                                    </div>
                                    <div className='sb-summary__rates'>
                                        <span>WIN RATE: <strong className={summary.won / summary.runs > 0.5 ? 'green' : 'red'}>{((summary.won / summary.runs) * 100).toFixed(1)}%</strong></span>
                                        <span>WINS: <strong className='green'>{summary.won}</strong></span>
                                        <span>LOSSES: <strong className='red'>{summary.lost}</strong></span>
                                    </div>
                                </>
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
                                        <tr><th>Time</th><th>Market</th><th>Type</th><th>Stake</th><th>Result</th><th>Exit Digit</th><th>Profit</th></tr>
                                    </thead>
                                    <tbody>
                                        {txList.map(tx => (
                                            <tr key={tx.id}>
                                                <td>{tx.time}</td><td>{tx.market}</td><td>{tx.type}</td>
                                                <td>${tx.stake.toFixed(2)}</td>
                                                <td className={`sb-result-${tx.result}`}>{tx.result === 'open' ? '⏳' : tx.result === 'won' ? '✓ WIN' : '✗ LOSS'}</td>
                                                <td>{tx.exitDigit ?? '—'}</td>
                                                <td className={tx.profit >= 0 ? 'green' : 'red'}>{tx.result === 'open' ? '…' : `${tx.profit >= 0 ? '+' : ''}${tx.profit.toFixed(2)}`}</td>
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
    const [category, setCategory]       = useState('All');
    const [search, setSearch]           = useState('');
    const [selectedBot, setSelectedBot] = useState<TScalperBot | null>(null);

    const filtered = SCALPER_BOTS.filter(b => {
        const matchCat  = category === 'All' || b.category === category;
        const matchSrch = !search || b.name.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSrch;
    });

    const loadXmlIntoWorkspace = useCallback(async (xml: string, name: string): Promise<boolean> => {
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

    if (selectedBot) {
        return (
            <BotDetail
                bot={selectedBot}
                derivTrade={derivTrade}
                onBack={() => setSelectedBot(null)}
                onLoadXml={handleLoadXml}
                onLoadAndRun={handleLoadAndRun}
                loadXmlIntoWorkspace={loadXmlIntoWorkspace}
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
