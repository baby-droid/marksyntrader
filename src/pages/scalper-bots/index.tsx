// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import manifest from '../../../public/bots/scalpers/manifest.json';
import './scalper-bots.scss';

/* ─── Account Type Badge ─── */
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
    return (
        <span className={`scalper-bots__acct-badge ${isDemo ? 'demo' : 'real'}`}>
            {isDemo ? '🔵 DEMO ACCOUNT' : '🟢 REAL ACCOUNT'}
        </span>
    );
};

type TScalperBot = {
    key: string;
    name: string;
    category: 'Even/Odd' | 'Over/Under';
    contractType: string;
    prediction: number | null;
    multiple: boolean;
    xmlFile: string;
};

const SCALPER_BOTS: TScalperBot[] = manifest as TScalperBot[];
const CATEGORIES = ['All', 'Even/Odd', 'Over/Under'];

const SYMBOLS = [
    { label: 'V10 1s', value: '1HZ10V' },
    { label: 'V25 1s', value: '1HZ25V' },
    { label: 'V50 1s', value: '1HZ50V' },
    { label: 'V75 1s', value: '1HZ75V' },
    { label: 'V100 1s', value: '1HZ100V' },
    { label: 'V10', value: 'R_10' },
    { label: 'V25', value: 'R_25' },
    { label: 'V50', value: 'R_50' },
    { label: 'V75', value: 'R_75' },
    { label: 'V100', value: 'R_100' },
];

const SCAN_MSGS = [
    'Scanning market conditions...',
    'Analysing digit frequencies...',
    'Computing probability matrix...',
    'Checking volatility window...',
    'Entry signal detected...',
    'Optimal tick window opening...',
    'Monitoring tick stream...',
    'Signal confirmed — preparing order...',
];

type BotStats = { trades: number; wins: number; losses: number; profit: number; currentStake: number };

const iconFor = (ct: string) =>
    ct === 'DIGITEVEN' ? '2️⃣' : ct === 'DIGITODD' ? '1️⃣' : ct === 'DIGITOVER' ? '⬆️' : '⬇️';

const accentFor = (ct: string) =>
    ct === 'DIGITEVEN' ? '#00c8ff' : ct === 'DIGITODD' ? '#ff8c00'
    : ct === 'DIGITOVER' ? '#00ff88' : '#ff2d55';

/* ────────────────── BotCard ────────────────── */
const BotCard: React.FC<{
    bot: TScalperBot;
    symbol: string;
    derivTrade: ReturnType<typeof useDerivTrade>;
    onLoadBot: (bot: TScalperBot) => Promise<void>;
    onLoadAndRun: (bot: TScalperBot) => Promise<void>;
}> = ({ bot, symbol, derivTrade, onLoadBot, onLoadAndRun }) => {
    const [stake, setStake]           = useState(0.35);
    const [martingale, setMartingale] = useState(2);
    const [running, setRunning]       = useState(false);
    const [loadingXml, setLoadingXml] = useState(false);
    const [stats, setStats]           = useState<BotStats>({ trades: 0, wins: 0, losses: 0, profit: 0, currentStake: 0.35 });
    const [log, setLog]               = useState<{ text: string; kind: string }[]>([]);

    const stopRef   = useRef(false);
    const stakeRef  = useRef(stake);
    const martRef   = useRef(martingale);
    const symbolRef = useRef(symbol);

    useEffect(() => { stakeRef.current  = stake;    }, [stake]);
    useEffect(() => { martRef.current   = martingale;}, [martingale]);
    useEffect(() => { symbolRef.current = symbol;    }, [symbol]);

    const addLog = useCallback((text: string, kind = 'info') => {
        const ts = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLog(prev => [{ text: `[${ts}] ${text}`, kind }, ...prev].slice(0, 60));
    }, []);

    const startBot = useCallback(async () => {
        if (running || !derivTrade.authorized) return;
        stopRef.current = false;
        setRunning(true);
        setStats({ trades: 0, wins: 0, losses: 0, profit: 0, currentStake: stakeRef.current });
        setLog([]);

        let curStake = stakeRef.current;

        // Initial scan animation
        for (let i = 0; i < 4 && !stopRef.current; i++) {
            addLog(SCAN_MSGS[i], 'scan');
            await new Promise(r => setTimeout(r, 200 + i * 80));
        }
        addLog(`🚀 BOT ACTIVE — ${bot.contractType}${bot.prediction !== null ? ` [>${bot.prediction}]` : ''} | Stake: $${curStake.toFixed(2)}`, 'start');

        while (!stopRef.current) {
            try {
                // Quick scan message between trades
                if (Math.random() < 0.4) {
                    addLog(SCAN_MSGS[Math.floor(Math.random() * SCAN_MSGS.length)], 'scan');
                    await new Promise(r => setTimeout(r, 100));
                    if (stopRef.current) break;
                }

                const profit = await new Promise<number>((resolve) => {
                    const params: any = {
                        symbol: symbolRef.current,
                        contract_type: bot.contractType,
                        duration: 1,
                        duration_unit: 't',
                        stake: curStake,
                    };
                    if (bot.prediction !== null) params.barrier = bot.prediction;
                    derivTrade.buyContract(params, settled => resolve(settled.profit ?? 0))
                        .catch(() => resolve(0));
                });

                if (stopRef.current) break;

                const won = profit > 0;
                const nextStake = won
                    ? stakeRef.current
                    : Math.max(0.35, +(curStake * martRef.current).toFixed(2));

                setStats(s => ({
                    trades: s.trades + 1,
                    wins: s.wins + (won ? 1 : 0),
                    losses: s.losses + (won ? 0 : 1),
                    profit: +(s.profit + profit).toFixed(2),
                    currentStake: nextStake,
                }));

                addLog(
                    `${won ? '✅ WIN' : '❌ LOSS'}  profit: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} USD  stake: $${curStake.toFixed(2)}`,
                    won ? 'win' : 'loss'
                );

                if (won) {
                    curStake = stakeRef.current;
                    if (!bot.multiple) {
                        addLog('🏁 Single-run complete. Bot stopped.', 'info');
                        break;
                    }
                    addLog('🔄 Cycling — scanning next entry...', 'scan');
                    await new Promise(r => setTimeout(r, 150));
                } else {
                    addLog(`⚡ Martingale → next stake: $${nextStake.toFixed(2)}`, 'mart');
                    curStake = nextStake;
                }
            } catch (err: any) {
                addLog(`⚠️ ${err?.error?.message || err?.message || 'Trade error'}`, 'loss');
                await new Promise(r => setTimeout(r, 1200));
            }
        }

        addLog('⏹ Bot stopped.', 'info');
        setRunning(false);
    }, [running, derivTrade, bot, addLog]);

    const stopBot = useCallback(() => {
        stopRef.current = true;
    }, []);

    const resetBot = useCallback(() => {
        stopRef.current = true;
        setRunning(false);
        setStats({ trades: 0, wins: 0, losses: 0, profit: 0, currentStake: stakeRef.current });
        setLog([]);
    }, []);

    const accent = accentFor(bot.contractType);

    return (
        <div className={`scalper-bots__card ${running ? 'scalper-bots__card--running' : ''}`}
            style={{ '--accent': accent } as React.CSSProperties}>
            <div className='scalper-bots__card-glow' />

            {/* Card header */}
            <div className='scalper-bots__card-head'>
                <div className='scalper-bots__card-icon-ring'>
                    <span className='scalper-bots__card-icon'>{iconFor(bot.contractType)}</span>
                </div>
                <div style={{ flex: 1 }}>
                    <h3 className='scalper-bots__bot-name'>{bot.name}</h3>
                    <div className='scalper-bots__badge-row'>
                        <span className='scalper-bots__badge-type'>{bot.contractType}</span>
                        {bot.prediction !== null && (
                            <span className='scalper-bots__badge-pred'>BARRIER {bot.prediction}</span>
                        )}
                        <span className={`scalper-bots__badge-mode ${bot.multiple ? 'multi' : 'single'}`}>
                            {bot.multiple ? 'MULTI' : 'SINGLE'}
                        </span>
                    </div>
                </div>
                {running && <div className='scalper-bots__running-dot' title='RUNNING' />}
            </div>

            {/* Stats */}
            <div className='scalper-bots__stats-row'>
                <div className='scalper-bots__stat'>
                    <span>TRADES</span><strong>{stats.trades}</strong>
                </div>
                <div className='scalper-bots__stat green'>
                    <span>WINS</span><strong>{stats.wins}</strong>
                </div>
                <div className='scalper-bots__stat red'>
                    <span>LOSSES</span><strong>{stats.losses}</strong>
                </div>
                <div className={`scalper-bots__stat ${stats.profit >= 0 ? 'green' : 'red'}`}>
                    <span>P/L</span>
                    <strong>{stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}</strong>
                </div>
            </div>

            {/* Config */}
            <div className='scalper-bots__card-controls'>
                <div className='scalper-bots__ctrl-field'>
                    <label>STAKE ($)</label>
                    <input type='number' min='0.35' step='0.01' value={stake}
                        onChange={e => setStake(Math.max(0.35, Number(e.target.value)))}
                        disabled={running} />
                </div>
                <div className='scalper-bots__ctrl-field'>
                    <label>MARTINGALE ×</label>
                    <input type='number' min='1' max='10' step='0.5' value={martingale}
                        onChange={e => setMartingale(Math.max(1, Number(e.target.value)))}
                        disabled={running} />
                </div>
            </div>

            {/* Terminal log */}
            <div className='scalper-bots__terminal'>
                <div className='scalper-bots__terminal-bar'>
                    <div className='scalper-bots__terminal-dots'>
                        <span /><span /><span />
                    </div>
                    <span>TRADE TERMINAL</span>
                    {running && <span className='scalper-bots__terminal-live'>● LIVE</span>}
                </div>
                <div className='scalper-bots__terminal-body'>
                    {log.length === 0 ? (
                        <div className='scalper-bots__terminal-empty'>
                            {running ? '> Initializing...' : '> Idle. Press START to scan.'}
                        </div>
                    ) : (
                        log.slice(0, 10).map((l, i) => (
                            <div key={i} className={`scalper-bots__terminal-line ${l.kind}`}>
                                {l.text}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* XML Bot Builder buttons */}
            <div className='scalper-bots__xml-row'>
                <button
                    className='scalper-bots__load-builder-btn'
                    onClick={() => { setLoadingXml(true); onLoadBot(bot).finally(() => setLoadingXml(false)); }}
                    disabled={loadingXml || running}>
                    {loadingXml ? '⏳' : '📂'} Load in Builder
                </button>
                <button
                    className='scalper-bots__load-run-btn'
                    onClick={() => { setLoadingXml(true); onLoadAndRun(bot).finally(() => setLoadingXml(false)); }}
                    disabled={loadingXml || running}>
                    {loadingXml ? '⏳' : '▶'} Load &amp; Run
                </button>
            </div>

            {/* Action buttons (direct API execution) */}
            <div className='scalper-bots__btn-row'>
                {!running ? (
                    <button className='scalper-bots__start-btn'
                        onClick={startBot}
                        disabled={!derivTrade.authorized}>
                        {!derivTrade.authorized ? '○ Connecting...' : '⚡ QUICK RUN'}
                    </button>
                ) : (
                    <button className='scalper-bots__stop-btn' onClick={stopBot}>
                        ⏹ STOP
                    </button>
                )}
                <button className='scalper-bots__reset-btn' onClick={resetBot} title='Reset stats & log'>↺</button>
            </div>
        </div>
    );
};

/* ────────────────── Main Page ────────────────── */
const ScalperBots: React.FC = observer(() => {
    const store       = useStore();
    const derivTrade  = useDerivTrade();
    const [category, setCategory]   = useState('All');
    const [search, setSearch]       = useState('');
    const [symbol, setSymbol]       = useState('1HZ100V');
    const [disclaimer, setDisclaimer] = useState(true);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    /* ── XML loading helpers (same pattern as Free Bots) ── */
    const loadXmlIntoWorkspace = useCallback(async (xml: string, name: string) => {
        const workspace = (window as any).Blockly?.derivWorkspace;
        if (!workspace) return false;
        const lm: any = store?.load_modal;
        if (lm?.loadStrategyToBuilder) {
            try {
                await lm.loadStrategyToBuilder({ id: name, xml, name, save_type: 'unsaved' }, false);
                return true;
            } catch {}
        }
        try {
            const B = (window as any).Blockly;
            const dom = B.Xml.textToDom(xml);
            B.derivWorkspace.asyncClear?.();
            B.Xml.domToWorkspace(dom, B.derivWorkspace);
            B.derivWorkspace.strategy_to_load = xml;
            B.svgResize?.(B.derivWorkspace);
            try { B.derivWorkspace.scrollCenter?.(); } catch (_) {}
            return true;
        } catch { return false; }
    }, [store]);

    const autoRun = useCallback(async () => {
        const rp: any = store?.run_panel;
        if (!rp?.onRunButtonClick) return;
        for (let i = 0; i < 6; i++) {
            try { if (!rp.is_running) await rp.onRunButtonClick(); return; }
            catch { if (i < 5) await new Promise(r => setTimeout(r, 500)); }
        }
    }, [store]);

    const handleLoadBot = useCallback(async (bot: TScalperBot) => {
        try {
            const res = await fetch(bot.xmlFile);
            if (!res.ok) throw new Error();
            const xml = await res.text();
            (window as any).__pendingBotXml  = xml;
            (window as any).__pendingBotName = bot.name;
            store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
            store?.run_panel?.toggleDrawer?.(true);
            let ok = await loadXmlIntoWorkspace(xml, bot.name);
            if (!ok) {
                ok = await new Promise<boolean>(resolve => {
                    let attempts = 0;
                    const poll = setInterval(async () => {
                        attempts++;
                        const r = await loadXmlIntoWorkspace(xml, bot.name);
                        if (r || attempts >= 50) { clearInterval(poll); resolve(r); }
                    }, 100);
                });
            }
        } catch (e) {
            console.error('Load bot error', e);
            store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
        }
    }, [store, loadXmlIntoWorkspace]);

    const handleLoadAndRun = useCallback(async (bot: TScalperBot) => {
        await handleLoadBot(bot);
        setTimeout(() => autoRun(), 900);
    }, [handleLoadBot, autoRun]);

    const filtered = SCALPER_BOTS.filter(b => {
        const matchCat  = category === 'All' || b.category === category;
        const matchSrch = !search || b.name.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSrch;
    });

    return (
        <div className='scalper-bots'>
            {disclaimer && (
                <div className='scalper-bots__disclaimer'>
                    <span className='scalper-bots__disclaimer-icon'>⚠</span>
                    <div className='scalper-bots__disclaimer-text'>
                        <strong>RISK DISCLAIMER</strong> — Scalper bots execute real trades directly on your Deriv account.
                        On a loss the stake is multiplied (martingale) and the bot retries immediately.
                        Single-run bots stop on the first win; Multi-run bots cycle continuously. Trade responsibly.
                    </div>
                    <button className='scalper-bots__disclaimer-close' onClick={() => setDisclaimer(false)}>✕</button>
                </div>
            )}

            {/* Header */}
            <div className='scalper-bots__header'>
                <div className='scalper-bots__header-left'>
                    <h1>⚡ <span>AHMED SCALPER BOTS</span></h1>
                    <p>{SCALPER_BOTS.length} embedded scalper strategies · Direct API execution · No Bot Builder needed</p>
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

            {/* Global symbol selector */}
            <div className='scalper-bots__global-ctrl'>
                <div className='scalper-bots__global-label'>
                    <span>🌐</span> GLOBAL MARKET — all bots trade on this symbol:
                </div>
                <div className='scalper-bots__symbol-pills'>
                    {SYMBOLS.map(s => (
                        <button key={s.value}
                            className={`scalper-bots__symbol-pill ${symbol === s.value ? 'active' : ''}`}
                            onClick={() => setSymbol(s.value)}>
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters */}
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

            {/* Grid */}
            <div className='scalper-bots__grid'>
                {filtered.map(bot => (
                    <BotCard
                        key={bot.key}
                        bot={bot}
                        symbol={symbol}
                        derivTrade={derivTrade}
                        onLoadBot={handleLoadBot}
                        onLoadAndRun={handleLoadAndRun}
                    />
                ))}
            </div>
        </div>
    );
});

export default ScalperBots;
