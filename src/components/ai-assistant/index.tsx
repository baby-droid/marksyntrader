// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { setExecutionSpeed } from '@/utils/execution-speed';
import { buildKillerXml, KillerContract } from '@/utils/killer-bot';
import './ai-assistant.scss';

/**
 * AI Market Scanner — scans all synthetic, jump, bull and bear index markets.
 * Manual SCAN button. Tick logic: <75% → 2-3 ticks, ≥75% → 1 tick.
 * Matches/Differs: AI auto-selects best digit.
 * Take Profit / Stop Loss injected into bot XML (same as stake/martingale).
 * Auto-execute: loads bot and auto-starts run button.
 * Converts profit/stake display to active currency (USD or KSH).
 */

const SCAN_SYMBOLS = [
    // Volatility — Continuous Indices
    { label: 'Volatility 10 Index', symbol: 'R_10', group: 'Volatility', submarket: 'random_index' },
    { label: 'Volatility 25 Index', symbol: 'R_25', group: 'Volatility', submarket: 'random_index' },
    { label: 'Volatility 50 Index', symbol: 'R_50', group: 'Volatility', submarket: 'random_index' },
    { label: 'Volatility 75 Index', symbol: 'R_75', group: 'Volatility', submarket: 'random_index' },
    { label: 'Volatility 100 Index', symbol: 'R_100', group: 'Volatility', submarket: 'random_index' },
    { label: 'Volatility 10 (1s)', symbol: '1HZ10V', group: 'Volatility 1s', submarket: 'random_index_s1' },
    { label: 'Volatility 25 (1s)', symbol: '1HZ25V', group: 'Volatility 1s', submarket: 'random_index_s1' },
    { label: 'Volatility 50 (1s)', symbol: '1HZ50V', group: 'Volatility 1s', submarket: 'random_index_s1' },
    { label: 'Volatility 75 (1s)', symbol: '1HZ75V', group: 'Volatility 1s', submarket: 'random_index_s1' },
    { label: 'Volatility 100 (1s)', symbol: '1HZ100V', group: 'Volatility 1s', submarket: 'random_index_s1' },
    // Jump Indices
    { label: 'Jump 10 Index', symbol: 'JD10', group: 'Jump Indices', submarket: 'jump_index' },
    { label: 'Jump 25 Index', symbol: 'JD25', group: 'Jump Indices', submarket: 'jump_index' },
    { label: 'Jump 50 Index', symbol: 'JD50', group: 'Jump Indices', submarket: 'jump_index' },
    { label: 'Jump 75 Index', symbol: 'JD75', group: 'Jump Indices', submarket: 'jump_index' },
    { label: 'Jump 100 Index', symbol: 'JD100', group: 'Jump Indices', submarket: 'jump_index' },
    // Daily Reset Indices (Bull / Bear)
    { label: 'Bear Market Index', symbol: 'RDBEAR', group: 'Daily Reset Indices', submarket: 'daily_reset_index' },
    { label: 'Bull Market Index', symbol: 'RDBULL', group: 'Daily Reset Indices', submarket: 'daily_reset_index' },
    // Step
    { label: 'Step Index', symbol: 'stpRNG', group: 'Step', submarket: 'step_index' },
];

type ContractType = KillerContract;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function getTickCount(confidence: number, is1s: boolean): number {
    return confidence >= 75 ? 1 : is1s ? 2 : 3;
}

function momentumRun(prices: number[]): { dir: 1 | -1 | 0; run: number } {
    if (prices.length < 3) return { dir: 0, run: 0 };
    let dir: 1 | -1 | 0 = 0; let run = 0;
    for (let i = prices.length - 1; i > 0; i--) {
        const step = prices[i] - prices[i - 1];
        const d = step > 0 ? 1 : step < 0 ? -1 : 0;
        if (d === 0) break;
        if (dir === 0) { dir = d; run = 1; }
        else if (d === dir) run++;
        else break;
    }
    return { dir, run };
}

interface DigitFreq {
    symbol: string; label: string; group: string;
    pcts: number[]; ticks: number[]; prices: number[]; total: number;
}

interface Signal {
    symbol: string; label: string; group: string;
    type: ContractType; barrier?: number; confidence: number;
    ticks: number; note: string; autoDigit?: number;
}

function evaluateAutoMatches(freq: DigitFreq): Signal | null {
    const { pcts, ticks, label, symbol, group } = freq;
    const is1s = symbol.includes('HZ');
    if (freq.total < 50) return null;

    // Longest absence strategy
    let bestMissing: number | null = null; let longestAbsence = 0;
    for (let d = 0; d <= 9; d++) {
        let absent = 0;
        for (let i = ticks.length - 1; i >= 0; i--) { if (ticks[i] === d) break; absent++; }
        if (absent >= 12 && absent > longestAbsence) { longestAbsence = absent; bestMissing = d; }
    }
    if (bestMissing !== null) {
        const conf = clamp(60 + (longestAbsence - 12) * 2, 60, 90);
        return { symbol, label, group, type: 'matches', barrier: bestMissing, confidence: conf, ticks: getTickCount(conf, is1s), autoDigit: bestMissing, note: `Digit ${bestMissing} absent ${longestAbsence} ticks — due for return.` };
    }

    // Double echo
    if (ticks.length >= 2 && ticks.slice(-2)[0] === ticks.slice(-2)[1]) {
        const d = ticks[ticks.length - 1];
        const conf = clamp(62 + pcts[d] * 1.5, 62, 88);
        return { symbol, label, group, type: 'matches', barrier: d, confidence: conf, ticks: getTickCount(conf, is1s), autoDigit: d, note: `Double echo ${d}${d} — likely to revisit.` };
    }

    // High frequency digit
    let bestD = -1; let bestPct = 0;
    for (let d = 0; d <= 9; d++) { if (pcts[d] > bestPct) { bestPct = pcts[d]; bestD = d; } }
    if (bestPct >= 13.5 && bestD >= 0) {
        const conf = clamp(55 + (bestPct - 13.5) * 6, 55, 92);
        return { symbol, label, group, type: 'matches', barrier: bestD, confidence: conf, ticks: getTickCount(conf, is1s), autoDigit: bestD, note: `Digit ${bestD} at ${bestPct.toFixed(1)}% — elevated frequency.` };
    }
    return null;
}

function evaluateAutoDiffers(freq: DigitFreq): Signal | null {
    const { pcts, ticks, label, symbol, group } = freq;
    const is1s = symbol.includes('HZ');
    if (freq.total < 30) return null;

    // Triple repetition
    if (ticks.length >= 3) {
        const last3 = ticks.slice(-3);
        if (last3[0] === last3[1] && last3[1] === last3[2]) {
            const d = last3[0];
            const conf = 90;
            return { symbol, label, group, type: 'differs', barrier: d, confidence: conf, ticks: getTickCount(conf, is1s), autoDigit: d, note: `Digit ${d} repeated 3× — exhaustion, differs highly probable.` };
        }
    }

    // Double repetition
    if (ticks.length >= 2 && ticks.slice(-2)[0] === ticks.slice(-2)[1]) {
        const d = ticks[ticks.length - 1];
        const conf = clamp(82 + (10 - pcts[d]) * 1.5, 82, 96);
        return { symbol, label, group, type: 'differs', barrier: d, confidence: conf, ticks: getTickCount(conf, is1s), autoDigit: d, note: `Digit ${d} repeated twice — differs high probability.` };
    }

    // Burst dominance (4+ in last 10)
    const last10 = ticks.slice(-10);
    const freqMap = new Array(10).fill(0);
    last10.forEach(t => freqMap[t]++);
    let domDigit = -1; let domCount = 0;
    freqMap.forEach((c, d) => { if (c > domCount) { domCount = c; domDigit = d; } });
    if (domCount >= 4 && domDigit >= 0) {
        const conf = clamp(78 + (domCount - 4) * 3, 78, 94);
        return { symbol, label, group, type: 'differs', barrier: domDigit, confidence: conf, ticks: getTickCount(conf, is1s), autoDigit: domDigit, note: `Digit ${domDigit} dominant (${domCount}/10) — burst reversal.` };
    }

    // Low frequency
    let minD = -1; let minPct = 100;
    for (let d = 0; d <= 9; d++) { if (pcts[d] < minPct) { minPct = pcts[d]; minD = d; } }
    if (minPct <= 7.5 && minD >= 0) {
        const conf = clamp(80 + (7.5 - minPct) * 4, 80, 96);
        return { symbol, label, group, type: 'differs', barrier: minD, confidence: conf, ticks: getTickCount(conf, is1s), autoDigit: minD, note: `Digit ${minD} at ${minPct.toFixed(1)}% — high differs probability.` };
    }
    return null;
}

function evaluate(freq: DigitFreq, type: ContractType, predictionDigit: number): Signal | null {
    const { pcts, label, symbol, group } = freq;
    const is1s = symbol.includes('HZ');
    if (freq.total < 30) return null;

    if (type === 'matches') return evaluateAutoMatches(freq);
    if (type === 'differs') return evaluateAutoDiffers(freq);

    if (type === 'over') {
        const N = predictionDigit;
        const losing = Array.from({ length: N + 1 }, (_, i) => i);
        if (!losing.every(d => pcts[d] < 10.0)) return null;
        const shield = N + 1; const shieldPct = shield <= 9 ? pcts[shield] : 0;
        if (shieldPct < 10.2) return null;
        const conf = clamp(70 + (shieldPct - 10.2) * 14 + (10 - Math.max(...losing.map(d => pcts[d]))) * 4, 70, 99);
        return { symbol, label, group, type, barrier: N, confidence: conf, ticks: getTickCount(conf, is1s), note: `Digits 0-${N} all <10%. Shield ${shield} at ${shieldPct.toFixed(1)}%.` };
    }

    if (type === 'under') {
        const N = predictionDigit;
        const losing = Array.from({ length: 10 - N }, (_, i) => N + i);
        if (!losing.every(d => pcts[d] < 10.0)) return null;
        const shield = N - 1; const shieldPct = shield >= 0 ? pcts[shield] : 0;
        if (shieldPct < 10.2) return null;
        const conf = clamp(70 + (shieldPct - 10.2) * 14 + (10 - Math.max(...losing.map(d => pcts[d]))) * 4, 70, 99);
        return { symbol, label, group, type, barrier: N, confidence: conf, ticks: getTickCount(conf, is1s), note: `Digits ${N}-9 all <10%. Shield ${shield} at ${shieldPct.toFixed(1)}%.` };
    }

    if (type === 'rise' || type === 'fall') {
        const { dir, run } = momentumRun(freq.prices);
        if (run < 3) return null;
        if ((type === 'rise' && dir !== 1) || (type === 'fall' && dir !== -1)) return null;
        if (Math.max(...pcts) > 14) return null;
        const QUALITY: Record<string, number> = { '1HZ10V': 6, '1HZ25V': 6, '1HZ50V': 4, R_10: 4, R_25: 3, JD10: 5 };
        const conf = clamp(58 + (run - 3) * 7 + (QUALITY[symbol] ?? 0) * 3, 58, 92);
        return { symbol, label, group, type, confidence: conf, ticks: getTickCount(conf, is1s), note: `${run} consecutive ${type === 'rise' ? 'up' : 'down'} ticks with stable digit dist.` };
    }

    const evenPct = [0, 2, 4, 6, 8].reduce((s, d) => s + pcts[d], 0);
    if (type === 'even') {
        const above = [0, 2, 4, 6, 8].filter(d => pcts[d] >= 10.3).length;
        if (above < 3 || evenPct < 52) return null;
        const conf = clamp((evenPct - 50) * 4 + 62, 62, 95);
        return { symbol, label, group, type, confidence: conf, ticks: getTickCount(conf, is1s), note: `Even share ${evenPct.toFixed(1)}%, ${above} digits above 10.3%.` };
    }
    if (type === 'odd') {
        const oddPct = 100 - evenPct;
        const above = [1, 3, 5, 7, 9].filter(d => pcts[d] >= 10.3).length;
        if (above < 3 || evenPct >= 48) return null;
        const conf = clamp((50 - evenPct) * 4 + 62, 62, 95);
        return { symbol, label, group, type, confidence: conf, ticks: getTickCount(conf, is1s), note: `Odd share ${oddPct.toFixed(1)}%, ${above} digits above 10.3%.` };
    }
    return null;
}

const AIAssistant: React.FC = () => {
    const { dashboard, run_panel, load_modal } = useStore() as any;

    const [isOpen, setIsOpen] = useState(false);
    const [isPulsing, setIsPulsing] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState('');
    const [scannedCount, setScannedCount] = useState(0);

    const [contractType, setContractType] = useState<ContractType>('over');
    const [predictionDigit, setPredictionDigit] = useState(4);
    const [stake, setStake] = useState(0.5);
    const [martingale, setMartingale] = useState(2.2);
    const [takeProfit, setTakeProfit] = useState(10);
    const [stopLoss, setStopLoss] = useState(5);

    const [best, setBest] = useState<Signal | null>(null);
    const [allSignals, setAllSignals] = useState<Signal[]>([]);
    const [autoRun, setAutoRun] = useState(true);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());

    const wsRefs = useRef<WebSocket[]>([]);
    const freqRef = useRef<Map<string, DigitFreq>>(new Map());
    const scanDoneRef = useRef(false);
    const autoRunTimer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    const fmtStake = (usd: number) => `${fromUsd(usd).toFixed(2)} ${displayCur}`;
    const fmtProfit = (usd: number) => `${fromUsd(usd).toFixed(2)} ${displayCur}`;

    const stopScan = useCallback(() => {
        wsRefs.current.forEach(ws => { try { ws.close(); } catch { } });
        wsRefs.current = [];
        setScanning(false);
        setScanProgress('');
        scanDoneRef.current = false;
    }, []);

    const recompute = useCallback(() => {
        const signals: Signal[] = [];
        let ready = 0;
        freqRef.current.forEach(freq => {
            if (freq.total > 30) {
                ready++;
                const sig = evaluate(freq, contractType, predictionDigit);
                if (sig) signals.push(sig);
            }
        });
        signals.sort((a, b) => b.confidence - a.confidence);
        setScannedCount(ready);
        setAllSignals(signals);
        setBest(signals[0] ?? null);
    }, [contractType, predictionDigit]);

    const startScan = useCallback(() => {
        stopScan();
        freqRef.current.clear();
        setBest(null);
        setAllSignals([]);
        setScannedCount(0);
        setScanning(true);
        scanDoneRef.current = false;

        SCAN_SYMBOLS.forEach(({ symbol, label, group }) => {
            freqRef.current.set(symbol, { symbol, label, group, pcts: new Array(10).fill(10), ticks: [], prices: [], total: 0 });
        });

        let idx = 0;
        const scanNext = () => {
            if (idx >= SCAN_SYMBOLS.length || scanDoneRef.current) {
                setScanning(false);
                setScanProgress(`Scan complete — ${SCAN_SYMBOLS.length} markets`);
                return;
            }
            const { symbol, label, group } = SCAN_SYMBOLS[idx];
            setScanProgress(`Scanning ${label}... (${idx + 1}/${SCAN_SYMBOLS.length})`);

            const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
            wsRefs.current.push(ws);
            let received = false;

            ws.onopen = () => { ws.send(JSON.stringify({ ticks_history: symbol, count: 500, end: 'latest', style: 'ticks' })); };
            ws.onmessage = e => {
                if (received) return;
                const d = JSON.parse(e.data);
                const freq = freqRef.current.get(symbol);
                if (!freq) return;
                if (d.history?.prices) {
                    received = true;
                    const prices = d.history.prices as number[];
                    freq.prices = prices.slice(-500);
                    freq.ticks = prices.map((p: number) => { const s = p.toFixed(2).replace('.', ''); return parseInt(s[s.length - 1], 10); });
                    freq.total = freq.ticks.length;
                    const counts = new Array(10).fill(0);
                    freq.ticks.forEach(t => counts[t]++);
                    freq.pcts = counts.map(c => freq.total > 0 ? (c / freq.total) * 100 : 10);
                    recompute();
                    try { ws.close(); } catch { }
                    idx++;
                    setTimeout(scanNext, 80);
                }
                if (d.error) { received = true; try { ws.close(); } catch { } idx++; setTimeout(scanNext, 80); }
            };
            ws.onerror = () => { if (!received) { received = true; idx++; setTimeout(scanNext, 80); } };
            setTimeout(() => { if (!received) { received = true; try { ws.close(); } catch { } idx++; scanNext(); } }, 5000);
        };
        scanNext();
    }, [recompute, stopScan]);

    useEffect(() => { if (!scanning) recompute(); }, [contractType, predictionDigit]);
    useEffect(() => () => { stopScan(); scanDoneRef.current = true; }, [stopScan]);

    const loadAndRun = useCallback(async (sig?: Signal) => {
        const signal = sig ?? best;
        if (!signal) return;
        const actualBarrier = signal.autoDigit !== undefined ? signal.autoDigit : (signal.barrier ?? predictionDigit);

        try {
            const res = await fetch('/bots/any-market-killer.xml');
            const raw = await res.text();
            const xml = buildKillerXml(raw, {
                symbol: signal.symbol,
                contract: signal.type,
                barrier: actualBarrier,
                ticks: signal.ticks,
                stake,
                martingale,
                takeProfit,
                stopLoss,
            });

            (window as any).__pendingBotXml = xml;
            (window as any).__pendingBotName = `AI ${signal.type.toUpperCase()}${actualBarrier !== undefined ? actualBarrier : ''}`;
            setExecutionSpeed('turbo');

            // Switch to Bot Builder tab
            dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
            run_panel?.toggleDrawer?.(true);

            const loadNow = async (): Promise<boolean> => {
                if (!(window as any).Blockly?.derivWorkspace) return false;
                if (load_modal?.loadStrategyToBuilder) {
                    try {
                        await load_modal.loadStrategyToBuilder(
                            { id: `ai_${signal.type}${actualBarrier ?? ''}`, xml, name: (window as any).__pendingBotName, save_type: 'unsaved' },
                            false
                        );
                        return true;
                    } catch { }
                }
                try {
                    const B = (window as any).Blockly;
                    const dom = B.Xml.textToDom(xml);
                    B.derivWorkspace.asyncClear?.() ?? B.derivWorkspace.clear?.();
                    B.Xml.domToWorkspace(dom, B.derivWorkspace);
                    B.derivWorkspace.strategy_to_load = xml;
                    B.svgResize?.(B.derivWorkspace);
                    B.derivWorkspace.scrollCenter?.();
                    return true;
                } catch { return false; }
            };

            const triggerRun = () => {
                (window as any).__pendingBotXml = null;
                (window as any).__pendingBotName = null;
                if (autoRun) {
                    // Retry run button click until bot starts
                    let attempts = 0;
                    const tryRun = () => {
                        const { is_running } = run_panel as any;
                        if (is_running) return;
                        run_panel?.onRunButtonClick?.();
                        attempts++;
                        if (!is_running && attempts < 20) {
                            autoRunTimer.current = setTimeout(tryRun, 300);
                        }
                    };
                    setTimeout(tryRun, 800);
                }
            };

            if (!(await loadNow())) {
                let attempts = 0;
                const poll = setInterval(async () => {
                    attempts++;
                    if (await loadNow() || attempts >= 80) {
                        clearInterval(poll);
                        if (attempts < 80) triggerRun();
                    }
                }, 100);
            } else {
                triggerRun();
            }

            setIsOpen(false);
        } catch (err) {
            console.error('AI load & run failed', err);
        }
    }, [best, predictionDigit, dashboard, run_panel, load_modal, stake, martingale, takeProfit, stopLoss, autoRun]);

    useEffect(() => () => { if (autoRunTimer.current) clearTimeout(autoRunTimer.current); }, []);

    const isMatchesDiffers = contractType === 'matches' || contractType === 'differs';
    const isOverUnder = contractType === 'over' || contractType === 'under';
    const needsDigit = isOverUnder;
    const confClass = best ? (best.confidence >= 80 ? 'high' : best.confidence >= 70 ? 'medium' : 'low') : '';

    const digitOptions = contractType === 'over' ? [0,1,2,3,4,5,6,7]
        : contractType === 'under' ? [1,2,3,4,5,6,7,8,9]
        : [0,1,2,3,4,5,6,7,8,9];

    return (
        <>
            <button
                className={`ai-assistant__trigger ${isPulsing ? 'ai-assistant__trigger--pulse' : ''}`}
                onClick={() => { setIsOpen(true); setIsPulsing(false); }}
                title='AI Market Scanner'
            >
                <div className='ai-assistant__sphere'><span>AI</span></div>
            </button>

            {isOpen && (
                <div className='ai-assistant__overlay' onClick={() => setIsOpen(false)}>
                    <div className='ai-assistant__modal' onClick={e => e.stopPropagation()}>
                        <div className='ai-assistant__modal-header'>
                            <div className={`ai-assistant__status-dot ${scanning ? 'live' : ''}`} />
                            <h3>AI Market Scanner</h3>
                            {scanning && <span className='ai-assistant__live'>SCANNING {scannedCount}/{SCAN_SYMBOLS.length}</span>}
                            {!scanning && scannedCount > 0 && <span className='ai-assistant__live' style={{ color: '#00ff96' }}>✔ {scannedCount}/{SCAN_SYMBOLS.length}</span>}
                            <button className='ai-assistant__close' onClick={() => setIsOpen(false)}>✕</button>
                        </div>

                        <div className='ai-assistant__body'>
                            {/* Scan progress bar */}
                            {scanning && scanProgress && (
                                <div className='ai-assistant__scan-progress'>
                                    <div className='ai-assistant__scan-bar'>
                                        <div className='ai-assistant__scan-fill' style={{ width: `${(scannedCount / SCAN_SYMBOLS.length) * 100}%` }} />
                                    </div>
                                    <span>{scanProgress}</span>
                                </div>
                            )}

                            {/* Signal card */}
                            {best ? (
                                <div className={`ai-assistant__signal ai-assistant__signal--${confClass}`}>
                                    <div className='ai-assistant__signal-head'>
                                        <span className='ai-assistant__signal-found'>✔ Best signal found</span>
                                        <span className='ai-assistant__signal-conf'>{best.confidence.toFixed(1)}%</span>
                                    </div>
                                    <div className='ai-assistant__signal-market'>
                                        {best.label}
                                        <span className='ai-assistant__signal-group'> [{best.group}]</span>
                                    </div>
                                    <div className='ai-assistant__signal-type'>
                                        {best.type.toUpperCase()}{(best.autoDigit !== undefined ? best.autoDigit : best.barrier) !== undefined ? ` ${best.autoDigit !== undefined ? best.autoDigit : best.barrier}` : ''}
                                        {' '}· {best.ticks} tick{best.ticks > 1 ? 's' : ''}
                                        {isMatchesDiffers && best.autoDigit !== undefined && <span className='ai-assistant__auto-tag'>🤖 auto</span>}
                                    </div>
                                    <div className='ai-assistant__signal-note'>{best.note}</div>
                                    {allSignals.length > 1 && (
                                        <div className='ai-assistant__alt-signals'>
                                            <span>Also: </span>
                                            {allSignals.slice(1, 4).map((s, i) => (
                                                <span key={i} className='ai-assistant__alt' onClick={() => setBest(s)}>
                                                    {s.label.replace(' Index', '')} {s.type.toUpperCase()}{s.autoDigit !== undefined ? s.autoDigit : s.barrier !== undefined ? s.barrier : ''} ({s.confidence.toFixed(0)}%)
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <button className='ai-assistant__load-run' onClick={() => loadAndRun()}>
                                        ⚡ Load &amp; {autoRun ? 'Auto-Run' : 'Run'} Bot
                                    </button>
                                </div>
                            ) : !scanning ? (
                                <div className='ai-assistant__searching'>
                                    <span>{scannedCount > 0 ? 'No high-confidence setup found. Try different settings or scan again.' : 'Press SCAN to analyse all markets.'}</span>
                                </div>
                            ) : (
                                <div className='ai-assistant__searching'>
                                    <div className='ai-assistant__pulse' />
                                    <span>Scanning markets one by one…</span>
                                </div>
                            )}

                            {/* Trade type */}
                            <div className='ai-assistant__field'>
                                <label>TRADE TYPE</label>
                                <div className='ai-assistant__trade-types'>
                                    {(['over', 'under', 'even', 'odd', 'rise', 'fall', 'matches', 'differs'] as ContractType[]).map(t => (
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

                            {/* Barrier digit for over/under */}
                            {needsDigit && (
                                <div className='ai-assistant__field'>
                                    <label>BARRIER DIGIT</label>
                                    <select value={predictionDigit} onChange={e => setPredictionDigit(Number(e.target.value))}>
                                        {digitOptions.map(d => <option key={d} value={d}>{contractType.charAt(0).toUpperCase() + contractType.slice(1)} {d}</option>)}
                                    </select>
                                </div>
                            )}
                            {isMatchesDiffers && (
                                <div className='ai-assistant__auto-note'>
                                    🤖 AI auto-selects best digit for {contractType}
                                </div>
                            )}

                            {/* Stake + Martingale row */}
                            <div className='ai-assistant__field-row'>
                                <div className='ai-assistant__field'>
                                    <label>STAKE ({displayCur})</label>
                                    <input type='number' value={stake} min={0.35} step={0.1}
                                        onChange={e => setStake(Number(e.target.value))} />
                                </div>
                                <div className='ai-assistant__field'>
                                    <label>MARTINGALE</label>
                                    <input type='number' value={martingale} min={1} step={0.1}
                                        onChange={e => setMartingale(Number(e.target.value))} />
                                </div>
                            </div>

                            {/* Take Profit + Stop Loss row — same style as Stake/Martingale */}
                            <div className='ai-assistant__field-row'>
                                <div className='ai-assistant__field'>
                                    <label>TAKE PROFIT ({displayCur})</label>
                                    <input type='number' value={takeProfit} min={0.5} step={0.5}
                                        onChange={e => setTakeProfit(Number(e.target.value))} />
                                </div>
                                <div className='ai-assistant__field'>
                                    <label>STOP LOSS ({displayCur})</label>
                                    <input type='number' value={stopLoss} min={0.5} step={0.5}
                                        onChange={e => setStopLoss(Number(e.target.value))} />
                                </div>
                            </div>

                            {/* Auto-run toggle */}
                            <div className='ai-assistant__field'>
                                <label className='ai-assistant__toggle-label'>
                                    <input type='checkbox' checked={autoRun} onChange={e => setAutoRun(e.target.checked)} />
                                    <span>AUTO-RUN after loading (trades until stopped manually)</span>
                                </label>
                            </div>
                        </div>

                        <div className='ai-assistant__footer'>
                            {scanning ? (
                                <button className='ai-assistant__btn ai-assistant__btn--cancel' onClick={stopScan}>⏹ Stop Scan</button>
                            ) : (
                                <button className='ai-assistant__btn ai-assistant__btn--scan' onClick={startScan}>🔍 SCAN ALL MARKETS</button>
                            )}
                            <button className='ai-assistant__btn ai-assistant__btn--load' onClick={() => loadAndRun()} disabled={!best}>
                                {best ? `⚡ Load & ${autoRun ? 'Auto-Run' : 'Run'}` : 'No signal yet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIAssistant;
