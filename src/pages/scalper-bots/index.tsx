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

type BotConfig = {
    market: string; duration: number; stake: number;
    martingale: number;
    stopOnLoss: boolean; consecutiveLossLimit: number;
    tpGuard: boolean; takeProfit: number; stopLoss: number;
};

const DEFAULT_CONFIG = (bot: TScalperBot): BotConfig => ({
    market: '1HZ10V', duration: 1, stake: 0.35, martingale: 2,
    stopOnLoss: bot.multiple,
    consecutiveLossLimit: bot.contractType === 'DIGITEVEN' || bot.contractType === 'DIGITODD' ? 5
        : bot.prediction !== null && bot.prediction <= 2 ? 5 : 5,
    tpGuard: bot.multiple,
    takeProfit: 100, stopLoss: bot.contractType === 'DIGITODD' ? 500 : 300,
});

const MARKETS = [
    { label: 'V10 1s',  value: '1HZ10V'  }, { label: 'V25 1s',  value: '1HZ25V'  },
    { label: 'V50 1s',  value: '1HZ50V'  }, { label: 'V75 1s',  value: '1HZ75V'  },
    { label: 'V100 1s', value: '1HZ100V' }, { label: 'V10',     value: 'R_10'     },
    { label: 'V25',     value: 'R_25'    }, { label: 'V50',     value: 'R_50'     },
    { label: 'V75',     value: 'R_75'    }, { label: 'V100',    value: 'R_100'    },
    { label: 'Jump 10', value: 'JD10'    }, { label: 'Jump 25', value: 'JD25'     },
    { label: 'Jump 50', value: 'JD50'    }, { label: 'Jump 75', value: 'JD75'     },
    { label: 'Jump 100',value: 'JD100'   },
];

const SCALPER_BOTS: TScalperBot[] = manifest as TScalperBot[];
const CATEGORIES = ['All', 'Even/Odd', 'Over/Under'];

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
    return (
        <span className={`sb-acct-badge ${isDemo ? 'demo' : 'real'}`}>
            {isDemo ? '🔵 DEMO' : '🟢 REAL'}
        </span>
    );
};

function getLastDigit(q: number): number {
    const s = q.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

function contractLabel(bot: TScalperBot): string {
    if (bot.contractType === 'DIGITEVEN') return 'EVEN';
    if (bot.contractType === 'DIGITODD')  return 'ODD';
    if (bot.contractType === 'DIGITOVER') return `OVER ${bot.prediction}`;
    if (bot.contractType === 'DIGITUNDER') return `UNDER ${bot.prediction}`;
    return bot.contractType;
}

/* ══════════════════════════════════════════════
   BotDetail — EliteTraders DBot-style UI
   ══════════════════════════════════════════════ */
const BotDetail: React.FC<{
    bot: TScalperBot;
    derivTrade: ReturnType<typeof useDerivTrade>;
    onBack: () => void;
    onLoadXml: (bot: TScalperBot) => Promise<void>;
    onLoadAndRun: (bot: TScalperBot) => Promise<void>;
}> = ({ bot, derivTrade, onBack, onLoadXml, onLoadAndRun }) => {
    const [cfg, setCfg]         = useState<BotConfig>(() => DEFAULT_CONFIG(bot));
    const [running, setRunning] = useState(false);
    const [tab, setTab]         = useState<'summary' | 'transactions' | 'journal'>('summary');
    const [terminal, setTerminal] = useState<{ t: string; msg: string; kind: string }[]>([]);
    const [txList, setTxList]   = useState<TxRecord[]>([]);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    const [loadingXml, setLoadingXml] = useState(false);

    const stopRef        = useRef(false);
    const consLossRef    = useRef(0);
    const sessionPnlRef  = useRef(0);
    const txIdRef        = useRef(0);
    const termRef        = useRef<HTMLDivElement>(null);

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    const summary = useMemo(() => {
        const won  = txList.filter(t => t.result === 'won').length;
        const lost = txList.filter(t => t.result === 'lost').length;
        const pnl  = txList.reduce((a, t) => a + t.profit, 0);
        return { runs: txList.length, won, lost, pnl };
    }, [txList]);

    const ts = () => new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const addLog = useCallback((msg: string, kind = 'info') => {
        setTerminal(prev => [{ t: ts(), msg, kind }, ...prev].slice(0, 200));
    }, []);

    /* ── Scroll terminal to top on new entry ── */
    useEffect(() => {
        if (termRef.current) termRef.current.scrollTop = 0;
    }, [terminal.length]);

    const startBot = useCallback(async () => {
        if (running || !derivTrade.authorized) return;
        stopRef.current = false;
        consLossRef.current = 0;
        sessionPnlRef.current = 0;
        setRunning(true);
        setTerminal([]);

        addLog(`▶ Bot started — ${contractLabel(bot)} | Market: ${cfg.market} | Stake: $${cfg.stake.toFixed(2)}`, 'start');
        if (cfg.stopOnLoss)
            addLog(`⚙ Stop after ${cfg.consecutiveLossLimit} consecutive losses`, 'config');
        if (cfg.tpGuard)
            addLog(`⚙ TP: $${cfg.takeProfit} | SL: $${cfg.stopLoss}`, 'config');

        let curStake = cfg.stake;

        while (!stopRef.current) {
            try {
                addLog(`📡 Waiting for tick — ${contractLabel(bot)}`, 'scan');

                const params: any = {
                    symbol: cfg.market,
                    contract_type: bot.contractType,
                    duration: cfg.duration,
                    duration_unit: 't',
                    stake: curStake,
                };
                if (bot.prediction !== null) params.barrier = String(bot.prediction);

                const txId = ++txIdRef.current;
                const openTx: TxRecord = {
                    id: txId, time: ts(), market: cfg.market,
                    type: contractLabel(bot), stake: curStake,
                    barrier: bot.prediction, result: 'open', profit: 0, exitDigit: null,
                };
                setTxList(prev => [openTx, ...prev]);

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

                const won = profit > 0;
                sessionPnlRef.current = +(sessionPnlRef.current + profit).toFixed(2);

                if (won) {
                    consLossRef.current = 0;
                    curStake = cfg.stake;
                    addLog(`✅ WIN  profit: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} USD  P/L: ${sessionPnlRef.current >= 0 ? '+' : ''}${sessionPnlRef.current.toFixed(2)}`, 'win');
                    if (!bot.multiple) {
                        addLog('🏁 Single-run complete — bot stopped on win.', 'info');
                        break;
                    }
                    addLog('🔄 Cycling to next trade...', 'scan');
                } else {
                    consLossRef.current++;
                    const nextStake = +(curStake * cfg.martingale).toFixed(2);
                    addLog(`❌ LOSS  profit: ${profit.toFixed(2)} USD  consecutive losses: ${consLossRef.current}  next stake: $${nextStake.toFixed(2)}`, 'loss');

                    if (cfg.stopOnLoss && consLossRef.current >= cfg.consecutiveLossLimit) {
                        addLog(`🛑 Reached ${cfg.consecutiveLossLimit} consecutive losses — bot stopped.`, 'stop');
                        break;
                    }
                    if (cfg.tpGuard) {
                        if (sessionPnlRef.current >= cfg.takeProfit) {
                            addLog(`🎯 Take profit $${cfg.takeProfit} reached — bot stopped.`, 'stop');
                            break;
                        }
                        if (sessionPnlRef.current <= -Math.abs(cfg.stopLoss)) {
                            addLog(`🛡 Stop loss -$${cfg.stopLoss} reached — bot stopped.`, 'stop');
                            break;
                        }
                    }
                    curStake = Math.max(0.35, nextStake);
                }

                // TP check after win too
                if (cfg.tpGuard && sessionPnlRef.current >= cfg.takeProfit) {
                    addLog(`🎯 Take profit $${cfg.takeProfit} reached — bot stopped.`, 'stop');
                    break;
                }
            } catch (err: any) {
                addLog(`⚠ ${err?.error?.message || err?.message || 'Trade error — retrying...'}`, 'error');
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        addLog('⏹ Bot stopped.', 'info');
        setRunning(false);
    }, [running, derivTrade, bot, cfg, addLog]);

    const stopBot = useCallback(() => {
        stopRef.current = true;
        addLog('⏸ Stop signal sent...', 'info');
    }, [addLog]);

    const cfgSet = (patch: Partial<BotConfig>) =>
        setCfg(prev => ({ ...prev, ...patch }));

    return (
        <div className='sb-detail'>
            {/* ── Header ── */}
            <div className='sb-detail__header'>
                <button className='sb-detail__back' onClick={onBack}>‹ Bots</button>
                <div className='sb-detail__title'>
                    <span className='sb-detail__icon'>{bot.contractType.includes('EVEN') ? '2️⃣' : bot.contractType.includes('ODD') ? '1️⃣' : bot.contractType.includes('OVER') ? '⬆️' : '⬇️'}</span>
                    <div>
                        <h2>{bot.name}</h2>
                        <span className={`sb-detail__status ${running ? 'running' : 'stopped'}`}>
                            STATUS: {running ? 'RUNNING' : 'STOPPED'}
                        </span>
                    </div>
                </div>
                <div className='sb-detail__header-right'>
                    <AccountBadge />
                    {derivTrade.balance !== null && (
                        <span className='sb-detail__balance'>{derivTrade.currency} {derivTrade.balance.toFixed(2)}</span>
                    )}
                    {!running ? (
                        <button className='sb-detail__start-btn'
                            onClick={startBot}
                            disabled={!derivTrade.authorized}>
                            {derivTrade.authorized ? '▶ RUN' : '○ Connecting...'}
                        </button>
                    ) : (
                        <button className='sb-detail__stop-btn' onClick={stopBot}>⏹ STOP</button>
                    )}
                    <button className='sb-detail__load-btn'
                        disabled={loadingXml}
                        onClick={() => { setLoadingXml(true); onLoadXml(bot).finally(() => setLoadingXml(false)); }}>
                        📂 Builder
                    </button>
                </div>
            </div>

            {/* ── Body ── */}
            <div className='sb-detail__body'>
                {/* Left sidebar — settings */}
                <div className='sb-detail__sidebar'>
                    {/* Trade Parameters */}
                    <div className='sb-section'>
                        <div className='sb-section__title'>1. Trade parameters</div>
                        <div className='sb-section__body'>
                            <div className='sb-field'>
                                <label>Market</label>
                                <select value={cfg.market} onChange={e => cfgSet({ market: e.target.value })} disabled={running}>
                                    {MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            <div className='sb-field'>
                                <label>Contract Type</label>
                                <span className='sb-badge'>{contractLabel(bot)}</span>
                            </div>
                            <div className='sb-field-row'>
                                <div className='sb-field'>
                                    <label>Duration</label>
                                    <input type='number' min={1} max={10} value={cfg.duration}
                                        onChange={e => cfgSet({ duration: Math.max(1, +e.target.value) })}
                                        disabled={running} />
                                    <span className='sb-unit'>Ticks</span>
                                </div>
                                <div className='sb-field'>
                                    <label>Stake (USD)</label>
                                    <input type='number' min={0.35} step={0.01} value={cfg.stake}
                                        onChange={e => cfgSet({ stake: Math.max(0.35, +e.target.value) })}
                                        disabled={running} />
                                </div>
                            </div>
                            <div className='sb-field'>
                                <label>Martingale ×</label>
                                <input type='number' min={1} max={10} step={0.5} value={cfg.martingale}
                                    onChange={e => cfgSet({ martingale: Math.max(1, +e.target.value) })}
                                    disabled={running} />
                            </div>
                        </div>
                    </div>

                    {/* Purchase Conditions */}
                    <div className='sb-section'>
                        <div className='sb-section__title'>2. Purchase conditions</div>
                        <div className='sb-section__body'>
                            <div className='sb-field'>
                                <label>Purchase</label>
                                <span className='sb-badge'>{contractLabel(bot)}</span>
                            </div>
                            <div className='sb-field'>
                                <label>Mode</label>
                                <span className='sb-badge'>{bot.multiple ? 'Multiple runs (cycle)' : 'Single run (stop on win)'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stop Trading */}
                    <div className='sb-section'>
                        <div className='sb-section__title-row'>
                            <div className='sb-section__title'>Stop Trading</div>
                            <button
                                className={`sb-toggle ${cfg.stopOnLoss ? 'on' : 'off'}`}
                                onClick={() => cfgSet({ stopOnLoss: !cfg.stopOnLoss })}
                                disabled={running}>
                                {cfg.stopOnLoss ? 'ACTIVE' : 'DISABLED'}
                            </button>
                        </div>
                        {cfg.stopOnLoss && (
                            <div className='sb-section__body'>
                                <div className='sb-field'>
                                    <label>Stop After</label>
                                    <input type='number' min={1} max={20} value={cfg.consecutiveLossLimit}
                                        onChange={e => cfgSet({ consecutiveLossLimit: Math.max(1, +e.target.value) })}
                                        disabled={running} />
                                    <span className='sb-unit'>Consecutive Losses</span>
                                </div>
                                <p className='sb-hint'>Bot stops after {cfg.consecutiveLossLimit} consecutive losses.</p>
                            </div>
                        )}
                    </div>

                    {/* TP/SL Guard */}
                    <div className='sb-section'>
                        <div className='sb-section__title-row'>
                            <div className='sb-section__title'>TP/SL Guard</div>
                            <button
                                className={`sb-toggle ${cfg.tpGuard ? 'on' : 'off'}`}
                                onClick={() => cfgSet({ tpGuard: !cfg.tpGuard })}
                                disabled={running}>
                                {cfg.tpGuard ? 'ACTIVE' : 'DISABLED'}
                            </button>
                        </div>
                        {cfg.tpGuard && (
                            <div className='sb-section__body'>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Take Profit ($)</label>
                                        <input type='number' min={1} value={cfg.takeProfit}
                                            onChange={e => cfgSet({ takeProfit: Math.max(1, +e.target.value) })}
                                            disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Stop Loss ($)</label>
                                        <input type='number' min={1} value={cfg.stopLoss}
                                            onChange={e => cfgSet({ stopLoss: Math.max(1, +e.target.value) })}
                                            disabled={running} />
                                    </div>
                                </div>
                                <div className='sb-tpsl-bar'>
                                    <span className='sb-tpsl-tp'>TARGET PROFIT +{cfg.takeProfit}</span>
                                    <span className='sb-tpsl-sl'>MAX DRAWDOWN -{cfg.stopLoss}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Builder Actions */}
                    <div className='sb-section'>
                        <div className='sb-section__title'>Bot Builder</div>
                        <div className='sb-section__body'>
                            <button className='sb-builder-btn'
                                onClick={() => { setLoadingXml(true); onLoadXml(bot).finally(() => setLoadingXml(false)); }}
                                disabled={loadingXml}>
                                📂 Load in Bot Builder
                            </button>
                            <button className='sb-builder-btn sb-builder-btn--run'
                                onClick={() => { setLoadingXml(true); onLoadAndRun(bot).finally(() => setLoadingXml(false)); }}
                                disabled={loadingXml}>
                                ▶ Load &amp; Run in Builder
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right — Execution Terminal */}
                <div className='sb-detail__terminal-col'>
                    <div className='sb-terminal'>
                        <div className='sb-terminal__bar'>
                            <div className='sb-terminal__dots'><span/><span/><span/></div>
                            <span>EXECUTION TERMINAL — {contractLabel(bot)}</span>
                            {running && <span className='sb-terminal__live'>● LIVE</span>}
                        </div>
                        <div className='sb-terminal__body' ref={termRef}>
                            {terminal.length === 0 ? (
                                <div className='sb-terminal__idle'>
                                    {running ? '> Initializing...' : '> Idle — press RUN to start'}
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
                        <button key={t} className={`sb-tabs__btn ${tab === t ? 'active' : ''}`}
                            onClick={() => setTab(t)}>
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
                                                    {tx.result === 'open' ? '…'
                                                        : `${tx.profit >= 0 ? '+' : ''}${tx.profit.toFixed(2)}`}
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
    const [category, setCategory] = useState('All');
    const [search, setSearch]     = useState('');
    const [selectedBot, setSelectedBot] = useState<TScalperBot | null>(null);

    const filtered = SCALPER_BOTS.filter(b => {
        const matchCat  = category === 'All' || b.category === category;
        const matchSrch = !search || b.name.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSrch;
    });

    /* ── XML loading helpers ── */
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

    if (selectedBot) {
        return (
            <BotDetail
                bot={selectedBot}
                derivTrade={derivTrade}
                onBack={() => setSelectedBot(null)}
                onLoadXml={handleLoadXml}
                onLoadAndRun={handleLoadAndRun}
            />
        );
    }

    return (
        <div className='scalper-bots'>
            {/* Header */}
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
                    <div key={bot.key} className='sb-card'
                        onClick={() => setSelectedBot(bot)}>
                        <div className='sb-card__icon'>
                            {bot.contractType.includes('EVEN') ? '2️⃣'
                                : bot.contractType.includes('ODD') ? '1️⃣'
                                : bot.contractType.includes('OVER') ? '⬆️' : '⬇️'}
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
