// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { setExecutionSpeed } from '@/utils/execution-speed';
import './ai-assistant.scss';

/**
 * Single floating circular AI.
 *
 * Scans the synthetic markets live (public Deriv tick stream) using the digit
 * distribution rules from the user's PDF and surfaces ONE high-confidence
 * contract that matches the user's target (contract type + prediction digit).
 * "Load & Run" loads the matching bot into the Bot Builder, applies the stake /
 * martingale, switches to turbo speed and starts the bot.
 */

const SCAN_SYMBOLS = [
    { label: 'Volatility 10 Index', symbol: 'R_10' },
    { label: 'Volatility 25 Index', symbol: 'R_25' },
    { label: 'Volatility 50 Index', symbol: 'R_50' },
    { label: 'Volatility 75 Index', symbol: 'R_75' },
    { label: 'Volatility 100 Index', symbol: 'R_100' },
    { label: 'Volatility 10 (1s) Index', symbol: '1HZ10V' },
    { label: 'Volatility 25 (1s) Index', symbol: '1HZ25V' },
    { label: 'Volatility 50 (1s) Index', symbol: '1HZ50V' },
    { label: 'Volatility 100 (1s) Index', symbol: '1HZ100V' },
];

type ContractType = 'over' | 'under' | 'even' | 'odd';

interface DigitFreq {
    symbol: string;
    label: string;
    pcts: number[];
    ticks: number[];
    total: number;
}

interface Signal {
    symbol: string;
    label: string;
    type: ContractType;
    barrier?: number;
    confidence: number;
    ticks: number;
    shieldDigit?: number;
    shieldPct?: number;
    note: string;
}

// Pre-built bots that ship with the app, keyed by contract type + barrier.
const PREBUILT_BOTS: Record<string, string> = {
    over1: '/bots/over1.xml',
    over2: '/bots/over2.xml',
    over3: '/bots/over3.xml',
    under6: '/bots/under6.xml',
    under7: '/bots/under7.xml',
    under8: '/bots/under8.xml',
    even: '/bots/ahmed-syn-even-odd.xml',
    odd: '/bots/ahmed-syn-even-odd.xml',
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Evaluate one market against the user's target (contract type + prediction digit). */
function evaluate(freq: DigitFreq, type: ContractType, predictionDigit: number): Signal | null {
    const { pcts, label, symbol } = freq;
    const is1s = symbol.includes('HZ');

    if (type === 'over') {
        const N = predictionDigit;
        const below = Array.from({ length: N + 1 }, (_, i) => i);
        if (!below.every(d => pcts[d] < 10.0)) return null;
        const shieldDigit = N + 1;
        const shieldPct = shieldDigit <= 9 ? pcts[shieldDigit] : 0;
        if (shieldPct < 10.3) return null;
        const maxBelow = Math.max(...below.map(d => pcts[d]));
        const confidence = clamp(70 + (shieldPct - 10.3) * 14 + (10 - maxBelow) * 4, 70, 99);
        return {
            symbol, label, type, barrier: N,
            confidence, ticks: N === 0 && !is1s ? 1 : 2,
            shieldDigit, shieldPct,
            note: `Digits 0-${N} under 10%. Shield digit ${shieldDigit} at ${shieldPct.toFixed(1)}%.`,
        };
    }

    if (type === 'under') {
        const N = predictionDigit;
        const below = Array.from({ length: 10 - N }, (_, i) => N + i);
        if (!below.every(d => pcts[d] < 10.0)) return null;
        const shieldDigit = N - 1;
        const shieldPct = shieldDigit >= 0 ? pcts[shieldDigit] : 0;
        if (shieldPct < 10.3) return null;
        const maxBelow = Math.max(...below.map(d => pcts[d]));
        const confidence = clamp(70 + (shieldPct - 10.3) * 14 + (10 - maxBelow) * 4, 70, 99);
        return {
            symbol, label, type, barrier: N,
            confidence, ticks: is1s ? 2 : 1,
            shieldDigit, shieldPct,
            note: `Digits ${N}-9 under 10%. Shield digit ${shieldDigit} at ${shieldPct.toFixed(1)}%.`,
        };
    }

    // Even / Odd — driven by even-digit share.
    const evenPct = [0, 2, 4, 6, 8].reduce((s, d) => s + pcts[d], 0);
    if (type === 'even' && evenPct >= 52) {
        return { symbol, label, type, confidence: clamp((evenPct - 50) * 4 + 60, 60, 95), ticks: 1, note: `Even share ${evenPct.toFixed(1)}%.` };
    }
    if (type === 'odd' && evenPct <= 48) {
        return { symbol, label, type, confidence: clamp((50 - evenPct) * 4 + 60, 60, 95), ticks: 1, note: `Odd share ${(100 - evenPct).toFixed(1)}%.` };
    }
    return null;
}

const AIAssistant: React.FC = () => {
    const { dashboard, run_panel, load_modal } = useStore() as any;

    const [isOpen, setIsOpen] = useState(false);
    const [isPulsing, setIsPulsing] = useState(true);
    const [scanning, setScanning] = useState(false);

    // Settings
    const [contractType, setContractType] = useState<ContractType>('over');
    const [predictionDigit, setPredictionDigit] = useState(2);
    const [stake, setStake] = useState(0.5);
    const [martingale, setMartingale] = useState(2.2);

    const [best, setBest] = useState<Signal | null>(null);
    const [scannedCount, setScannedCount] = useState(0);

    const wsRefs = useRef<WebSocket[]>([]);
    const freqRef = useRef<Map<string, DigitFreq>>(new Map());

    const isOverUnder = contractType === 'over' || contractType === 'under';

    const stopScan = useCallback(() => {
        wsRefs.current.forEach(ws => {
            try { ws.close(); } catch { /* noop */ }
        });
        wsRefs.current = [];
        setScanning(false);
    }, []);

    const recompute = useCallback(() => {
        let winner: Signal | null = null;
        let ready = 0;
        freqRef.current.forEach(freq => {
            if (freq.total > 60) ready += 1;
            const sig = evaluate(freq, contractType, predictionDigit);
            if (sig && (!winner || sig.confidence > winner.confidence)) winner = sig;
        });
        setScannedCount(ready);
        setBest(winner);
    }, [contractType, predictionDigit]);

    const startScan = useCallback(() => {
        stopScan();
        freqRef.current.clear();
        setBest(null);
        setScannedCount(0);
        setScanning(true);

        SCAN_SYMBOLS.forEach(({ symbol, label }) => {
            freqRef.current.set(symbol, { symbol, label, pcts: new Array(10).fill(10), ticks: [], total: 0 });
            const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
            wsRefs.current.push(ws);
            ws.onopen = () => {
                ws.send(JSON.stringify({ ticks_history: symbol, count: 500, end: 'latest', style: 'ticks' }));
                ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
            };
            ws.onmessage = e => {
                const d = JSON.parse(e.data);
                const freq = freqRef.current.get(symbol);
                if (!freq) return;

                if (d.history?.prices) {
                    const prices = d.history.prices;
                    freq.ticks = prices.map((p: number) => {
                        const s = p.toFixed(2).replace('.', '');
                        return parseInt(s[s.length - 1], 10);
                    });
                    freq.total = freq.ticks.length;
                }
                if (d.tick) {
                    const s = d.tick.quote.toFixed(2).replace('.', '');
                    freq.ticks = [...freq.ticks.slice(-499), parseInt(s[s.length - 1], 10)];
                    freq.total = freq.ticks.length;
                }
                const counts = new Array(10).fill(0);
                freq.ticks.forEach(t => counts[t]++);
                freq.pcts = counts.map(c => (freq.total > 0 ? (c / freq.total) * 100 : 10));
                recompute();
            };
        });
    }, [recompute, stopScan]);

    // Re-evaluate when the target changes mid-scan.
    useEffect(() => {
        if (scanning) recompute();
    }, [contractType, predictionDigit, scanning, recompute]);

    useEffect(() => () => stopScan(), [stopScan]);

    const applyStakeAndMartingale = (xml: string): string => {
        let out = xml;
        // Stake: first two math_number values are stake + initial stake in the shipped bots.
        let replaced = 0;
        out = out.replace(/(<field name="NUM">)0\.5(<\/field>)/g, (m, a, b) => {
            replaced += 1;
            return replaced <= 2 ? `${a}${stake}${b}` : m;
        });
        // Martingale multiplier (2.2 in the shipped bots).
        out = out.replace(/(<field name="NUM">)2\.2(<\/field>)/g, `$1${martingale}$2`);
        return out;
    };

    const loadAndRun = useCallback(async () => {
        if (!best) return;
        const key = isOverUnder ? `${best.type}${best.barrier}` : best.type;
        const file = PREBUILT_BOTS[key] || PREBUILT_BOTS.over2;
        try {
            const res = await fetch(file);
            const raw = await res.text();
            const xml = applyStakeAndMartingale(raw);

            (window as any).__pendingBotXml = xml;
            (window as any).__pendingBotName = `AI ${best.type.toUpperCase()}${best.barrier ?? ''}`;
            setExecutionSpeed('turbo');
            dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
            run_panel?.toggleDrawer?.(true);

            const loadNow = async () => {
                if (!(window as any).Blockly?.derivWorkspace) return false;
                if (load_modal?.loadStrategyToBuilder) {
                    try {
                        await load_modal.loadStrategyToBuilder(
                            { id: `ai_${key}`, xml, name: (window as any).__pendingBotName, save_type: 'unsaved' },
                            false
                        );
                        return true;
                    } catch {
                        /* fall through */
                    }
                }
                try {
                    const B = (window as any).Blockly;
                    const dom = B.Xml.textToDom(xml);
                    B.derivWorkspace.asyncClear();
                    B.Xml.domToWorkspace(dom, B.derivWorkspace);
                    B.derivWorkspace.strategy_to_load = xml;
                    B.svgResize?.(B.derivWorkspace);
                    B.derivWorkspace.scrollCenter?.();
                    return true;
                } catch {
                    return false;
                }
            };

            const finish = () => {
                (window as any).__pendingBotXml = null;
                (window as any).__pendingBotName = null;
                setTimeout(() => run_panel?.onRunButtonClick?.(), 700);
            };

            if (!(await loadNow())) {
                let attempts = 0;
                const poll = setInterval(async () => {
                    attempts += 1;
                    if ((await loadNow()) || attempts >= 80) {
                        clearInterval(poll);
                        if (attempts < 80) finish();
                    }
                }, 100);
            } else {
                finish();
            }
            setIsOpen(false);
        } catch (err) {
            console.error('AI load & run failed', err);
        }
    }, [best, isOverUnder, dashboard, run_panel, load_modal, stake, martingale]);

    const digitOptions = contractType === 'over' ? [0, 1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7, 8, 9];

    return (
        <>
            <button
                className={`ai-assistant__trigger ${isPulsing ? 'ai-assistant__trigger--pulse' : ''}`}
                onClick={() => {
                    setIsOpen(true);
                    setIsPulsing(false);
                    if (!scanning) startScan();
                }}
                title='AI Market Scanner'
            >
                <div className='ai-assistant__sphere'>
                    <span>AI</span>
                </div>
            </button>

            {isOpen && (
                <div className='ai-assistant__overlay' onClick={() => setIsOpen(false)}>
                    <div className='ai-assistant__modal' onClick={e => e.stopPropagation()}>
                        <div className='ai-assistant__modal-header'>
                            <div className={`ai-assistant__status-dot ${scanning ? 'live' : ''}`} />
                            <h3>AI Market Scanner</h3>
                            {scanning && <span className='ai-assistant__live'>LIVE · {scannedCount}/{SCAN_SYMBOLS.length}</span>}
                            <button className='ai-assistant__close' onClick={() => setIsOpen(false)}>✕</button>
                        </div>

                        <div className='ai-assistant__body'>
                            {/* Signal */}
                            {best ? (
                                <div className='ai-assistant__signal'>
                                    <div className='ai-assistant__signal-head'>
                                        <span className='ai-assistant__signal-found'>✔ Suitable market found</span>
                                        <span className='ai-assistant__signal-conf'>{best.confidence.toFixed(1)}%</span>
                                    </div>
                                    <div className='ai-assistant__signal-market'>{best.label}</div>
                                    <div className='ai-assistant__signal-type'>
                                        {best.type.toUpperCase()}{best.barrier !== undefined ? ` ${best.barrier}` : ''} · {best.ticks} tick{best.ticks > 1 ? 's' : ''}
                                    </div>
                                    <div className='ai-assistant__signal-note'>{best.note}</div>
                                    <button className='ai-assistant__load-run' onClick={loadAndRun}>
                                        ⚡ Load &amp; Run Bot (Turbo)
                                    </button>
                                </div>
                            ) : (
                                <div className='ai-assistant__searching'>
                                    <div className='ai-assistant__pulse' />
                                    <span>{scanning ? 'Scanning markets for a high-confidence setup…' : 'Press Scan to find a setup.'}</span>
                                </div>
                            )}

                            {/* Settings */}
                            <div className='ai-assistant__field'>
                                <label>TRADE TYPE</label>
                                <div className='ai-assistant__trade-types'>
                                    {(['over', 'under', 'even', 'odd'] as ContractType[]).map(t => (
                                        <button
                                            key={t}
                                            className={`ai-assistant__type-btn ${contractType === t ? 'active' : ''}`}
                                            onClick={() => setContractType(t)}
                                        >
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {isOverUnder && (
                                <div className='ai-assistant__field'>
                                    <label>PREDICTION DIGIT (scans for {contractType} {predictionDigit})</label>
                                    <select
                                        value={predictionDigit}
                                        onChange={e => setPredictionDigit(Number(e.target.value))}
                                    >
                                        {digitOptions.map(d => (
                                            <option key={d} value={d}>{contractType === 'over' ? 'Over' : 'Under'} {d}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className='ai-assistant__field-row'>
                                <div className='ai-assistant__field'>
                                    <label>STAKE</label>
                                    <input type='number' value={stake} min={0.35} step={0.1} onChange={e => setStake(Number(e.target.value))} />
                                </div>
                                <div className='ai-assistant__field'>
                                    <label>MARTINGALE</label>
                                    <input type='number' value={martingale} min={1} step={0.1} onChange={e => setMartingale(Number(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        <div className='ai-assistant__footer'>
                            <button className='ai-assistant__btn ai-assistant__btn--cancel' onClick={scanning ? stopScan : startScan}>
                                {scanning ? 'Stop' : 'New Scan'}
                            </button>
                            <button className='ai-assistant__btn ai-assistant__btn--scan' onClick={loadAndRun} disabled={!best}>
                                {best ? 'Load & Run' : 'Waiting for setup…'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIAssistant;
