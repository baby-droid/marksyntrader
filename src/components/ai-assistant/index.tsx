// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { reaction } from 'mobx';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton';
import { useDerivTrading } from '@/hooks/useDerivTrading';
import { buildKillerXml, KillerContract } from '@/utils/killer-bot';
import { getExecutionSpeed } from '@/utils/execution-speed';
import './ai-assistant.scss';

/**
 * AI Market Scanner + Direct-Fire Auto-Bot.
 *
 * "Load & Run Bot" flow:
 *  1. Injects stake / martingale / TP / SL into the killer-bot XML and loads
 *     it into the Blockly workspace for display.
 *  2. Flips the main Run panel into the "running" state (same signal the big
 *     dashboard Run button uses) so the whole app reflects that a bot is live.
 *  3. Starts a direct-fire trading loop, firing the very instant the previous
 *     contract settles — no artificial delay:
 *       buy (single round-trip) → wait for real settlement → martingale → repeat
 *     This runs continuously until the TP or SL threshold is hit, or the user
 *     clicks "Stop Bot" / the main Stop button.
 *
 * Stake / Take Profit / Stop Loss are plain USD — bot XML stakes/TP/SL are
 * always USD, so the AI must never convert to/from a display currency here.
 *
 * No checkbox required — Load & Run always fires continuously.
 */

const SCAN_SYMBOLS = [
    { label: 'Volatility 10 Index',   symbol: 'R_10',    group: 'Volatility'          },
    { label: 'Volatility 25 Index',   symbol: 'R_25',    group: 'Volatility'          },
    { label: 'Volatility 50 Index',   symbol: 'R_50',    group: 'Volatility'          },
    { label: 'Volatility 75 Index',   symbol: 'R_75',    group: 'Volatility'          },
    { label: 'Volatility 100 Index',  symbol: 'R_100',   group: 'Volatility'          },
    { label: 'Volatility 10 (1s)',    symbol: '1HZ10V',  group: 'Volatility 1s'       },
    { label: 'Volatility 25 (1s)',    symbol: '1HZ25V',  group: 'Volatility 1s'       },
    { label: 'Volatility 50 (1s)',    symbol: '1HZ50V',  group: 'Volatility 1s'       },
    { label: 'Volatility 75 (1s)',    symbol: '1HZ75V',  group: 'Volatility 1s'       },
    { label: 'Volatility 100 (1s)',   symbol: '1HZ100V', group: 'Volatility 1s'       },
    { label: 'Jump 10 Index',         symbol: 'JD10',    group: 'Jump Indices'        },
    { label: 'Jump 25 Index',         symbol: 'JD25',    group: 'Jump Indices'        },
    { label: 'Jump 50 Index',         symbol: 'JD50',    group: 'Jump Indices'        },
    { label: 'Jump 75 Index',         symbol: 'JD75',    group: 'Jump Indices'        },
    { label: 'Jump 100 Index',        symbol: 'JD100',   group: 'Jump Indices'        },
    { label: 'Bear Market Index',     symbol: 'RDBEAR',  group: 'Daily Reset Indices' },
    { label: 'Bull Market Index',     symbol: 'RDBULL',  group: 'Daily Reset Indices' },
    { label: 'Step Index',            symbol: 'stpRNG',  group: 'Step'                },
];

type ContractType = KillerContract;

const CONTRACT_TYPE_MAP: Record<ContractType, string> = {
    over:    'DIGITOVER',
    under:   'DIGITUNDER',
    even:    'DIGITEVEN',
    odd:     'DIGITODD',
    matches: 'DIGITMATCH',
    differs: 'DIGITDIFF',
    rise:    'CALL',
    fall:    'PUT',
};

const NEEDS_BARRIER: Set<ContractType> = new Set(['over', 'under', 'matches', 'differs']);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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

interface DigitFreq { symbol: string; label: string; group: string; pcts: number[]; ticks: number[]; prices: number[]; total: number; }
interface Signal { symbol: string; label: string; group: string; type: ContractType; barrier?: number; confidence: number; ticks: number; note: string; autoDigit?: number; }

/**
 * Rise/Fall and Matches/Differs must only ever use 1 or 2 ticks (never 3+).
 * Over/Under/Even/Odd keep the wider 1-3 tick range since they aren't
 * affected by the normalization request.
 */
function getTickCount(confidence: number, is1s: boolean, capAt2 = false): number {
    if (capAt2) return confidence >= 75 ? 1 : 2;
    return confidence >= 75 ? 1 : is1s ? 2 : 3;
}

function evaluateAutoMatches(freq: DigitFreq): Signal | null {
    const { pcts, ticks, label, symbol, group } = freq;
    const is1s = symbol.includes('HZ');
    if (freq.total < 50) return null;
    let bestMissing: number | null = null; let longestAbsence = 0;
    for (let d = 0; d <= 9; d++) {
        let absent = 0;
        for (let i = ticks.length - 1; i >= 0; i--) { if (ticks[i] === d) break; absent++; }
        if (absent >= 12 && absent > longestAbsence) { longestAbsence = absent; bestMissing = d; }
    }
    if (bestMissing !== null) {
        const conf = clamp(60 + (longestAbsence - 12) * 2, 60, 90);
        return { symbol, label, group, type: 'matches', barrier: bestMissing, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: bestMissing, note: `Digit ${bestMissing} absent ${longestAbsence} ticks.` };
    }
    if (ticks.length >= 2 && ticks.slice(-2)[0] === ticks.slice(-2)[1]) {
        const d = ticks[ticks.length - 1];
        const conf = clamp(62 + pcts[d] * 1.5, 62, 88);
        return { symbol, label, group, type: 'matches', barrier: d, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: d, note: `Double echo ${d}${d}.` };
    }
    let bestD = -1; let bestPct = 0;
    for (let d = 0; d <= 9; d++) { if (pcts[d] > bestPct) { bestPct = pcts[d]; bestD = d; } }
    if (bestPct >= 13.5 && bestD >= 0) {
        const conf = clamp(55 + (bestPct - 13.5) * 6, 55, 92);
        return { symbol, label, group, type: 'matches', barrier: bestD, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: bestD, note: `Digit ${bestD} at ${bestPct.toFixed(1)}%.` };
    }
    return null;
}

function evaluateAutoDiffers(freq: DigitFreq): Signal | null {
    const { pcts, ticks, label, symbol, group } = freq;
    const is1s = symbol.includes('HZ');
    if (freq.total < 30) return null;
    if (ticks.length >= 3) {
        const last3 = ticks.slice(-3);
        if (last3[0] === last3[1] && last3[1] === last3[2]) {
            const d = last3[0]; const conf = 90;
            return { symbol, label, group, type: 'differs', barrier: d, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: d, note: `Triple ${d}${d}${d} — exhaustion.` };
        }
    }
    if (ticks.length >= 2 && ticks.slice(-2)[0] === ticks.slice(-2)[1]) {
        const d = ticks[ticks.length - 1];
        const conf = clamp(82 + (10 - pcts[d]) * 1.5, 82, 96);
        return { symbol, label, group, type: 'differs', barrier: d, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: d, note: `Double ${d}${d} — differs high.` };
    }
    const last10 = ticks.slice(-10); const freqMap = new Array(10).fill(0);
    last10.forEach(t => freqMap[t]++);
    let domDigit = -1; let domCount = 0;
    freqMap.forEach((c, d) => { if (c > domCount) { domCount = c; domDigit = d; } });
    if (domCount >= 4 && domDigit >= 0) {
        const conf = clamp(78 + (domCount - 4) * 3, 78, 94);
        return { symbol, label, group, type: 'differs', barrier: domDigit, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: domDigit, note: `Digit ${domDigit} dominant ${domCount}/10.` };
    }
    let minD = -1; let minPct = 100;
    for (let d = 0; d <= 9; d++) { if (pcts[d] < minPct) { minPct = pcts[d]; minD = d; } }
    if (minPct <= 7.5 && minD >= 0) {
        const conf = clamp(80 + (7.5 - minPct) * 4, 80, 96);
        return { symbol, label, group, type: 'differs', barrier: minD, confidence: conf, ticks: getTickCount(conf, is1s, true), autoDigit: minD, note: `Digit ${minD} at ${minPct.toFixed(1)}%.` };
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
        return { symbol, label, group, type, confidence: conf, ticks: getTickCount(conf, is1s, true), note: `${run} consecutive ${type === 'rise' ? 'up' : 'down'} ticks.` };
    }
    const evenPct = [0, 2, 4, 6, 8].reduce((s, d) => s + pcts[d], 0);
    if (type === 'even') {
        const above = [0, 2, 4, 6, 8].filter(d => pcts[d] >= 10.3).length;
        if (above < 3 || evenPct < 52) return null;
        const conf = clamp((evenPct - 50) * 4 + 62, 62, 95);
        return { symbol, label, group, type, confidence: conf, ticks: getTickCount(conf, is1s), note: `Even share ${evenPct.toFixed(1)}%.` };
    }
    if (type === 'odd') {
        const oddPct = 100 - evenPct;
        const above = [1, 3, 5, 7, 9].filter(d => pcts[d] >= 10.3).length;
        if (above < 3 || evenPct >= 48) return null;
        const conf = clamp((50 - evenPct) * 4 + 62, 62, 95);
        return { symbol, label, group, type, confidence: conf, ticks: getTickCount(conf, is1s), note: `Odd share ${oddPct.toFixed(1)}%.` };
    }
    return null;
}

/** Wait for a digit/short-duration contract to settle and return its profit. */
async function waitForSettlement(contractId: string): Promise<number> {
    return new Promise(resolve => {
        let sub: any;
        const bail = setTimeout(() => { try { sub?.unsubscribe(); } catch { } resolve(0); }, 15000);
        try {
            const obs = api_base.api.subscribe({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
            sub = obs.subscribe({
                next: (res: any) => {
                    const poc = res?.proposal_open_contract;
                    if (poc?.is_sold || poc?.is_expired) {
                        clearTimeout(bail);
                        try { sub?.unsubscribe(); } catch { }
                        resolve(parseFloat(poc.profit ?? '0'));
                    }
                },
                error: () => { clearTimeout(bail); resolve(0); },
            });
        } catch { clearTimeout(bail); resolve(0); }
    });
}

const AIAssistant: React.FC = () => {
    const { dashboard, load_modal, run_panel } = useStore() as any;
    const { currency: accountCurrency } = useDerivTrading();

    const [isOpen, setIsOpen]         = useState(false);
    const [isPulsing, setIsPulsing]   = useState(true);
    const [scanning, setScanning]     = useState(false);
    const [scanProgress, setScanProgress] = useState('');
    const [scannedCount, setScannedCount] = useState(0);

    const [contractType, setContractType] = useState<ContractType>('over');
    const [predictionDigit, setPredictionDigit] = useState(4);
    const [stake, setStake]           = useState(0.5);
    const [martingale, setMartingale] = useState(2.2);
    const [takeProfit, setTakeProfit] = useState(10);
    const [stopLoss, setStopLoss]     = useState(5);

    const [best, setBest]             = useState<Signal | null>(null);
    const [allSignals, setAllSignals] = useState<Signal[]>([]);
    const [botRunning, setBotRunning] = useState(false);
    const [sessionProfit, setSessionProfit] = useState(0);
    const [tradeCount, setTradeCount] = useState(0);
    const [botLog, setBotLog]         = useState<string[]>([]);

    const wsRefs    = useRef<WebSocket[]>([]);
    const freqRef   = useRef<Map<string, DigitFreq>>(new Map());
    const scanDoneRef = useRef(false);
    const runRef    = useRef(false);
    const stakeRef  = useRef(stake);
    const tradeCountRef = useRef(0);
    const sessionProfitRef = useRef(0);

    useEffect(() => { stakeRef.current = stake; }, [stake]);

    // AI always operates in USD — no display-currency conversion here.
    const fmtProfit = (usd: number) => `${usd >= 0 ? '+' : ''}${usd.toFixed(2)} USD`;
    const fmtVal    = (usd: number) => `${usd.toFixed(2)} USD`;

    /* ─────────── Draggable trigger button ─────────── */
    const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
    const dragStateRef = useRef<{ startX: number; startY: number; origX: number; origY: number; dragging: boolean } | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    const onDragPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const btn = triggerRef.current;
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        dragStateRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: dragPos?.x ?? rect.left,
            origY: dragPos?.y ?? rect.top,
            dragging: false,
        };
        (e.target as HTMLButtonElement).setPointerCapture?.(e.pointerId);
    }, [dragPos]);

    const onDragPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const st = dragStateRef.current;
        if (!st) return;
        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;
        if (!st.dragging && Math.hypot(dx, dy) < 4) return;
        st.dragging = true;
        const btn = triggerRef.current;
        const w = btn?.offsetWidth ?? 60;
        const h = btn?.offsetHeight ?? 60;
        const x = Math.max(4, Math.min(window.innerWidth - w - 4, st.origX + dx));
        const y = Math.max(4, Math.min(window.innerHeight - h - 4, st.origY + dy));
        setDragPos({ x, y });
    }, []);

    const onDragPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const st = dragStateRef.current;
        (e.target as HTMLButtonElement).releasePointerCapture?.(e.pointerId);
        dragStateRef.current = null;
        if (st?.dragging) {
            // swallow the click that follows a drag so it doesn't reopen/close the modal
            const btn = triggerRef.current;
            if (btn) {
                const suppressClick = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
                btn.addEventListener('click', suppressClick, { capture: true, once: true });
            }
        }
    }, []);

    const addLog = useCallback((msg: string) => {
        const ts = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setBotLog(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 80));
    }, []);

    /* ─────────── Market scanner ─────────── */
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
            if (freq.total > 30) { ready++; const sig = evaluate(freq, contractType, predictionDigit); if (sig) signals.push(sig); }
        });
        signals.sort((a, b) => b.confidence - a.confidence);
        setScannedCount(ready);
        setAllSignals(signals);
        setBest(signals[0] ?? null);
    }, [contractType, predictionDigit]);

    const startScan = useCallback(() => {
        stopScan();
        freqRef.current.clear();
        setBest(null); setAllSignals([]); setScannedCount(0);
        setScanning(true); scanDoneRef.current = false;
        SCAN_SYMBOLS.forEach(({ symbol, label, group }) => {
            freqRef.current.set(symbol, { symbol, label, group, pcts: new Array(10).fill(10), ticks: [], prices: [], total: 0 });
        });
        let idx = 0;
        const scanNext = () => {
            if (idx >= SCAN_SYMBOLS.length || scanDoneRef.current) { setScanning(false); setScanProgress(`Scan complete — ${SCAN_SYMBOLS.length} markets`); return; }
            const { symbol, label } = SCAN_SYMBOLS[idx];
            setScanProgress(`Scanning ${label}... (${idx + 1}/${SCAN_SYMBOLS.length})`);
            const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
            wsRefs.current.push(ws);
            let received = false;
            ws.onopen = () => ws.send(JSON.stringify({ ticks_history: symbol, count: 500, end: 'latest', style: 'ticks' }));
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
                    idx++; setTimeout(scanNext, 80);
                }
                if (d.error) { received = true; try { ws.close(); } catch { } idx++; setTimeout(scanNext, 80); }
            };
            ws.onerror = () => { if (!received) { received = true; idx++; setTimeout(scanNext, 80); } };
            setTimeout(() => { if (!received) { received = true; try { ws.close(); } catch { } idx++; scanNext(); } }, 5000);
        };
        scanNext();
    }, [recompute, stopScan]);

    useEffect(() => { if (!scanning) recompute(); }, [contractType, predictionDigit]);
    useEffect(() => () => { stopScan(); scanDoneRef.current = true; runRef.current = false; }, [stopScan]);

    /* ─────────── Direct-fire bot loop ─────────── */
    const stopBot = useCallback(() => {
        runRef.current = false;
        setBotRunning(false);
        run_panel?.setIsRunning?.(false);
        addLog('⏹ Bot stopped by user.');
    }, [addLog, run_panel]);

    const loadAndRun = useCallback(async (sig?: Signal) => {
        const signal = sig ?? best;
        if (!signal) return;
        if (botRunning) { stopBot(); return; }

        const barrier = signal.autoDigit !== undefined ? signal.autoDigit : (signal.barrier ?? predictionDigit);
        const apiContractType = CONTRACT_TYPE_MAP[signal.type];

        // Reset session state
        sessionProfitRef.current = 0;
        tradeCountRef.current = 0;
        stakeRef.current = stake;
        setSessionProfit(0);
        setTradeCount(0);
        setBotLog([]);
        setBotRunning(true);
        runRef.current = true;
        setIsOpen(false);

        // Signal the main run panel to show "running" state
        run_panel?.setIsRunning?.(true);

        // Load the user's EVEN/ODD XML into the workspace for display (fire-and-forget)
        try {
            const res = await fetch('/bots/ahmed-syn-even-odd-killer.xml');
            if (res.ok) {
                const raw = await res.text();
                // Stake/TP/SL are always in USD — no conversion needed
                const xml = buildKillerXml(raw, { symbol: signal.symbol, contract: signal.type, barrier, ticks: signal.ticks, stake, martingale, takeProfit, stopLoss });
                (window as any).__pendingBotXml  = xml;
                (window as any).__pendingBotName = `AI ${signal.type.toUpperCase()}${barrier !== undefined ? barrier : ''}`;
                dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
                const loadWs = async () => {
                    const B = (window as any).Blockly;
                    if (!B?.derivWorkspace) return false;
                    try {
                        if (load_modal?.loadStrategyToBuilder) {
                            await load_modal.loadStrategyToBuilder({ id: `ai_${Date.now()}`, xml, name: (window as any).__pendingBotName, save_type: 'unsaved' }, false);
                        } else {
                            const dom = B.Xml.textToDom(xml);
                            B.derivWorkspace.asyncClear?.(); B.Xml.domToWorkspace(dom, B.derivWorkspace);
                        }
                        return true;
                    } catch { return false; }
                };
                loadWs().catch(() => {});
            }
        } catch { /* workspace load failed — direct fire still works */ }

        addLog(`🚀 Starting ${signal.type.toUpperCase()}${barrier !== undefined ? barrier : ''} on ${signal.label} | Stake:${fmtVal(stake)} | Mart:${martingale}x | TP:${fmtVal(takeProfit)} | SL:${fmtVal(stopLoss)}`);

        // ─── Direct-fire loop ───
        // Speed modes:
        //   Normal  — proposal + buy + wait for settlement (reliable, sequential)
        //   Crazy   — skip proposal, inline buy + wait for settlement (faster: saves 1 round-trip)
        //   Turbo   — skip proposal, inline buy, NO settlement wait (fire-and-forget, superhuman speed)
        (async () => {
            const inlineBuy = async (curStake: number) => {
                const res = await api_base.api.send({
                    buy: '1', price: curStake,
                    parameters: {
                        amount: curStake, basis: 'stake', contract_type: apiContractType,
                        currency: accountCurrency || 'USD', duration: signal.ticks, duration_unit: 't',
                        symbol: signal.symbol,
                        ...(NEEDS_BARRIER.has(signal.type) ? { barrier: String(barrier) } : {}),
                    },
                });
                return res?.buy?.contract_id ?? null;
            };

            const applyResult = (profit: number) => {
                tradeCountRef.current++;
                sessionProfitRef.current += profit;
                const sp = sessionProfitRef.current;
                const tc = tradeCountRef.current;
                setTradeCount(tc);
                setSessionProfit(sp);
                const won = profit >= 0;
                addLog(`${won ? '✅' : '❌'} #${tc} ${won ? 'WIN' : 'LOSS'} ${fmtProfit(profit)} | Session: ${fmtProfit(sp)} | Stake: ${fmtVal(stakeRef.current)}`);
                if (sp >= takeProfit) { addLog(`🏆 TAKE PROFIT hit! Session P/L: ${fmtProfit(sp)}`); runRef.current = false; setBotRunning(false); run_panel?.setIsRunning?.(false); }
                if (sp <= -stopLoss)  { addLog(`🛑 STOP LOSS hit! Session P/L: ${fmtProfit(sp)}`); runRef.current = false; setBotRunning(false); run_panel?.setIsRunning?.(false); }
                // Martingale: all in USD
                if (runRef.current) {
                    stakeRef.current = won ? stake : Math.max(0.35, +(stakeRef.current * martingale).toFixed(2));
                }
            };

            while (runRef.current) {
                const curStake = stakeRef.current;
                const speed = getExecutionSpeed();
                try {
                    if (speed === 'normal') {
                        // Normal: proposal → buy → wait settlement (most reliable)
                        let proposalId: string | null = null;
                        try {
                            const propRes = await api_base.api.send({
                                proposal: 1, amount: curStake, basis: 'stake',
                                contract_type: apiContractType, currency: accountCurrency || 'USD',
                                duration: signal.ticks, duration_unit: 't', symbol: signal.symbol,
                                ...(NEEDS_BARRIER.has(signal.type) ? { barrier: String(barrier) } : {}),
                            });
                            proposalId = propRes?.proposal?.id ?? null;
                        } catch { /* fallthrough to inline */ }

                        let contractId: string | null = null;
                        if (proposalId && runRef.current) {
                            try {
                                const buyRes = await api_base.api.send({ buy: proposalId, price: curStake });
                                contractId = buyRes?.buy?.contract_id ?? null;
                            } catch { /* fallthrough to inline */ }
                        }
                        if (!contractId) contractId = await inlineBuy(curStake);
                        if (!contractId || !runRef.current) break;
                        const profit = await waitForSettlement(contractId);
                        if (!runRef.current) break;
                        applyResult(profit);

                    } else if (speed === 'crazy') {
                        // Crazy: skip proposal, inline buy → wait settlement (1 round-trip faster)
                        const contractId = await inlineBuy(curStake);
                        if (!contractId || !runRef.current) break;
                        const profit = await waitForSettlement(contractId);
                        if (!runRef.current) break;
                        applyResult(profit);

                    } else {
                        // Turbo: inline buy, settlement tracked in background — fire immediately
                        const contractId = await inlineBuy(curStake);
                        if (!contractId) { await new Promise(r => setTimeout(r, 100)); continue; }
                        waitForSettlement(contractId).then(profit => {
                            if (runRef.current || profit !== 0) applyResult(profit);
                        });
                        // No waiting — loop instantly for next trade
                    }
                } catch (err: any) {
                    const msg = err?.error?.message || err?.message || 'Unknown error';
                    addLog(`⚠️ ${msg}`);
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            runRef.current = false;
            setBotRunning(false);
            run_panel?.setIsRunning?.(false);
        })();
    }, [best, predictionDigit, stake, martingale, takeProfit, stopLoss, botRunning, dashboard, load_modal, run_panel, addLog, stopBot]);

    const isMatchesDiffers = contractType === 'matches' || contractType === 'differs';
    const needsDigit       = contractType === 'over' || contractType === 'under';
    const confClass        = best ? (best.confidence >= 80 ? 'high' : best.confidence >= 70 ? 'medium' : 'low') : '';
    const digitOptions     = contractType === 'over' ? [0,1,2,3,4,5,6,7] : contractType === 'under' ? [1,2,3,4,5,6,7,8,9] : [0,1,2,3,4,5,6,7,8,9];

    return (
        <>
            {/* Status pill */}
            {botRunning && (
                <div className='ai-assistant__fire-pill' onClick={stopBot} title='Click to stop the bot'>
                    🤖 RUNNING #{tradeCount} | {fmtProfit(sessionProfit)} &nbsp;·&nbsp; <span style={{ color: '#ff6b6b' }}>⏹ STOP</span>
                </div>
            )}

            <button
                ref={triggerRef}
                className={`ai-assistant__trigger ${isPulsing ? 'ai-assistant__trigger--pulse' : ''} ${botRunning ? 'ai-assistant__trigger--running' : ''}`}
                style={dragPos ? { left: dragPos.x, top: dragPos.y, right: 'auto', bottom: 'auto' } : undefined}
                onClick={() => { setIsOpen(true); setIsPulsing(false); }}
                onPointerDown={onDragPointerDown}
                onPointerMove={onDragPointerMove}
                onPointerUp={onDragPointerUp}
                onPointerCancel={onDragPointerUp}
                title='AI Market Scanner (drag to move)'
            >
                <div className='ai-assistant__sphere'>
                    <span className='ai-assistant__clock-hand' />
                    <span>{botRunning ? '⏸' : 'AI'}</span>
                </div>
            </button>

            {isOpen && (
                <div className='ai-assistant__overlay' onClick={() => setIsOpen(false)}>
                    <div className='ai-assistant__modal' onClick={e => e.stopPropagation()}>
                        <div className='ai-assistant__modal-header'>
                            <div className={`ai-assistant__status-dot ${scanning ? 'live' : botRunning ? 'running' : ''}`} />
                            <h3>AI Market Scanner</h3>
                            {scanning && <span className='ai-assistant__live'>SCANNING {scannedCount}/{SCAN_SYMBOLS.length}</span>}
                            {botRunning && <span className='ai-assistant__live' style={{ color: '#00ff96' }}>🤖 #{tradeCount} | {fmtProfit(sessionProfit)}</span>}
                            <button className='ai-assistant__close' onClick={() => setIsOpen(false)}>✕</button>
                        </div>

                        <div className='ai-assistant__body'>
                            {scanning && scanProgress && (
                                <div className='ai-assistant__scan-progress'>
                                    <div className='ai-assistant__scan-bar'>
                                        <div className='ai-assistant__scan-fill' style={{ width: `${(scannedCount / SCAN_SYMBOLS.length) * 100}%` }} />
                                    </div>
                                    <span>{scanProgress}</span>
                                </div>
                            )}

                            {/* Bot live log */}
                            {botRunning && botLog.length > 0 && (
                                <div className='ai-assistant__bot-log'>
                                    {botLog.slice(0, 5).map((l, i) => <div key={i} className='ai-assistant__bot-log-entry'>{l}</div>)}
                                </div>
                            )}

                            {best ? (
                                <div className={`ai-assistant__signal ai-assistant__signal--${confClass}`}>
                                    <div className='ai-assistant__signal-head'>
                                        <span className='ai-assistant__signal-found'>✔ Best signal</span>
                                        <span className='ai-assistant__signal-conf'>{best.confidence.toFixed(1)}%</span>
                                    </div>
                                    <div className='ai-assistant__signal-market'>
                                        {best.label}<span className='ai-assistant__signal-group'> [{best.group}]</span>
                                    </div>
                                    <div className='ai-assistant__signal-type'>
                                        {best.type.toUpperCase()}{(best.autoDigit !== undefined ? best.autoDigit : best.barrier) !== undefined ? ` ${best.autoDigit !== undefined ? best.autoDigit : best.barrier}` : ''}
                                        {' '}· {best.ticks} tick{best.ticks > 1 ? 's' : ''}
                                        {isMatchesDiffers && best.autoDigit !== undefined && <span className='ai-assistant__auto-tag'>🤖 auto</span>}
                                    </div>
                                    <div className='ai-assistant__signal-note'>{best.note}</div>
                                    {allSignals.length > 1 && (
                                        <div className='ai-assistant__alt-signals'>
                                            <span>Alt: </span>
                                            {allSignals.slice(1, 4).map((s, i) => (
                                                <span key={i} className='ai-assistant__alt' onClick={() => setBest(s)}>
                                                    {s.label.replace(' Index', '')} {s.type.toUpperCase()}{s.autoDigit !== undefined ? s.autoDigit : s.barrier !== undefined ? s.barrier : ''} ({s.confidence.toFixed(0)}%)
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : !scanning ? (
                                <div className='ai-assistant__searching'>
                                    <span>{scannedCount > 0 ? 'No high-confidence setup. Try a different type or scan again.' : 'Press SCAN to analyse all markets.'}</span>
                                </div>
                            ) : (
                                <div className='ai-assistant__searching'>
                                    <div className='ai-assistant__pulse' />
                                    <span>Scanning markets...</span>
                                </div>
                            )}

                            {/* Trade type */}
                            <div className='ai-assistant__field'>
                                <label>TRADE TYPE</label>
                                <div className='ai-assistant__trade-types'>
                                    {(['over', 'under', 'even', 'odd', 'rise', 'fall', 'matches', 'differs'] as ContractType[]).map(t => (
                                        <button key={t} className={`ai-assistant__type-btn ${contractType === t ? 'active' : ''}`} onClick={() => setContractType(t)}>
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {needsDigit && (
                                <div className='ai-assistant__field'>
                                    <label>BARRIER DIGIT</label>
                                    <select value={predictionDigit} onChange={e => setPredictionDigit(Number(e.target.value))}>
                                        {digitOptions.map(d => <option key={d} value={d}>{contractType.charAt(0).toUpperCase() + contractType.slice(1)} {d}</option>)}
                                    </select>
                                </div>
                            )}
                            {isMatchesDiffers && <div className='ai-assistant__auto-note'>🤖 AI auto-selects best digit for {contractType}</div>}

                            {/* Stake + Martingale */}
                            <div className='ai-assistant__field-row'>
                                <div className='ai-assistant__field'>
                                    <label>STAKE (USD)</label>
                                    <input type='number' value={stake} min={0.35} step={0.1} onChange={e => { setStake(Number(e.target.value)); stakeRef.current = Number(e.target.value); }} />
                                </div>
                                <div className='ai-assistant__field'>
                                    <label>MARTINGALE ×</label>
                                    <input type='number' value={martingale} min={1} step={0.1} onChange={e => setMartingale(Number(e.target.value))} />
                                </div>
                            </div>

                            {/* TP + SL */}
                            <div className='ai-assistant__field-row'>
                                <div className='ai-assistant__field'>
                                    <label>TAKE PROFIT (USD)</label>
                                    <input type='number' value={takeProfit} min={0.5} step={0.5} onChange={e => setTakeProfit(Number(e.target.value))} />
                                </div>
                                <div className='ai-assistant__field'>
                                    <label>STOP LOSS (USD)</label>
                                    <input type='number' value={stopLoss} min={0.5} step={0.5} onChange={e => setStopLoss(Number(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        <div className='ai-assistant__footer'>
                            {scanning ? (
                                <button className='ai-assistant__btn ai-assistant__btn--cancel' onClick={stopScan}>⏹ Stop Scan</button>
                            ) : (
                                <button className='ai-assistant__btn ai-assistant__btn--scan' onClick={startScan}>🔍 SCAN ALL MARKETS</button>
                            )}
                            <button
                                className={`ai-assistant__btn ${botRunning ? 'ai-assistant__btn--stop-bot' : 'ai-assistant__btn--load'}`}
                                onClick={() => loadAndRun()}
                                disabled={!botRunning && !best}
                            >
                                {botRunning ? `⏹ Stop Bot (#${tradeCount})` : !best ? 'No signal yet' : '⚡ Load & Run Bot'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIAssistant;
