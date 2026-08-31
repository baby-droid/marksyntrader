// @ts-nocheck — the Deriv API response is intentionally flexible across
// history, tick and subscription envelopes.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer as globalObserver } from '@/external/bot-skeleton';
import { api_base } from '@/external/bot-skeleton';
import { isAuthorized$ } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import {
    DIFFERS_CYCLE_DEFINITIONS,
    DIFFERS_SCAN_MARKETS,
    DiffersCycleBotId,
    DiffersCycleStep,
    ScanPoint,
    bestDifferDigit,
    digitFromQuote,
    digitPercentages,
    entryPatternReady,
} from '@/utils/differs-cycle';
import './ai-cycle-guide.scss';

const WINDOW_SIZE = 50;
const MIN_READY_TICKS = 12;

type Props = {
    onLoadGuided?: (botId: DiffersCycleBotId, symbol: string, differDigit: number) => void;
};

type MarketSnapshot = {
    points: ScanPoint[];
    pipSize: number | null;
};

const emptyMarkets = (): Record<string, MarketSnapshot> =>
    Object.fromEntries(DIFFERS_SCAN_MARKETS.map(market => [market.symbol, { points: [], pipSize: null }]));

function scoreMarket(points: ScanPoint[], differDigit: number | null): number {
    if (points.length < MIN_READY_TICKS || differDigit === null) return -1;
    const percentages = digitPercentages(points);
    const dominantEdge = percentages[differDigit] ?? 0;
    const lastDigits = points.slice(-6).map(point => point.digit);
    const repeats = lastDigits.slice(1).filter((digit, index) => digit === lastDigits[index]).length;
    return dominantEdge * 4 + repeats * 2 + Math.min(points.length, WINDOW_SIZE) / WINDOW_SIZE;
}

const AiCycleGuide: React.FC<Props> = ({ onLoadGuided }) => {
    const [botId, setBotId] = useState<DiffersCycleBotId>('differs-edge-scanner');
    const [scanning, setScanning] = useState(false);
    const [status, setStatus] = useState('Ready to scan authenticated market feeds');
    const [markets, setMarkets] = useState<Record<string, MarketSnapshot>>(emptyMarkets);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [runCount, setRunCount] = useState(0);
    const [lastCycle, setLastCycle] = useState(0);
    const subscriptionsRef = useRef<any[]>([]);
    const subscriptionIdsRef = useRef<Set<string>>(new Set());
    const scanStartedRef = useRef(false);
    const seenContractsRef = useRef<Set<number>>(new Set());

    const definition = DIFFERS_CYCLE_DEFINITIONS[botId];
    const selectedMarket = selectedSymbol ? markets[selectedSymbol] : null;
    const rankedMarkets = useMemo(() => DIFFERS_SCAN_MARKETS
        .map(market => {
            const snapshot = markets[market.symbol];
            const differDigit = bestDifferDigit(snapshot?.points ?? []);
            return { ...market, snapshot, differDigit, score: scoreMarket(snapshot?.points ?? [], differDigit) };
        })
        .sort((a, b) => b.score - a.score), [markets]);
    const bestMarket = rankedMarkets[0]?.score >= 0 ? rankedMarkets[0] : null;
    const activeMarket = selectedMarket && selectedSymbol
        ? { ...DIFFERS_SCAN_MARKETS.find(market => market.symbol === selectedSymbol), snapshot: selectedMarket, differDigit: bestDifferDigit(selectedMarket.points) }
        : bestMarket;
    const currentStep: DiffersCycleStep = definition.steps[runCount % definition.steps.length];
    const differDigit = activeMarket?.differDigit ?? null;
    const entryReady = activeMarket?.snapshot?.points?.length >= MIN_READY_TICKS
        ? entryPatternReady(activeMarket.snapshot.points, currentStep, differDigit)
        : false;

    const stopScan = useCallback(() => {
        subscriptionsRef.current.forEach(subscription => {
            try { subscription.unsubscribe?.(); } catch {}
        });
        subscriptionIdsRef.current.forEach(subscriptionId => {
            try { api_base.api?.send({ forget: subscriptionId }); } catch {}
        });
        subscriptionIdsRef.current.clear();
        subscriptionsRef.current = [];
        setScanning(false);
        scanStartedRef.current = false;
    }, []);

    const startScan = useCallback(() => {
        if (scanStartedRef.current) return;
        const api = api_base.api;
        if (!api || !isAuthorized$.value) {
            setStatus('Login required — scan uses the authenticated Deriv market feed');
            return;
        }
        scanStartedRef.current = true;
        setScanning(true);
        setStatus('Subscribing to authenticated market feeds…');
        DIFFERS_SCAN_MARKETS.forEach(({ symbol }) => {
            try {
                const stream = api.subscribe({ ticks: symbol, subscribe: 1 });
                const subscription = stream.subscribe({
                    next: (response: any) => {
                        const tick = response?.tick;
                        if (!tick) return;
                        if (response.subscription?.id) subscriptionIdsRef.current.add(String(response.subscription.id));
                        const quote = Number(tick.quote);
                        const pipSize = Number(tick.pip_size);
                        if (!Number.isFinite(quote) || !Number.isFinite(pipSize)) return;
                        const point: ScanPoint = {
                            quote,
                            epoch: Number(tick.epoch ?? Date.now()),
                            digit: digitFromQuote(quote, pipSize),
                        };
                        setMarkets(previous => {
                            const current = previous[symbol] ?? { points: [], pipSize: null };
                            return {
                                ...previous,
                                [symbol]: {
                                    pipSize,
                                    points: [...current.points, point].slice(-WINDOW_SIZE),
                                },
                            };
                        });
                    },
                    error: () => setStatus('A market feed paused — keeping the remaining live feeds'),
                });
                subscriptionsRef.current.push(subscription);
            } catch {
                // A symbol can be unavailable for an account without invalidating
                // the other authenticated subscriptions.
            }
        });
        setStatus('Scanning markets · collecting 50-tick edge windows');
    }, []);

    useEffect(() => () => stopScan(), [stopScan]);

    useEffect(() => {
        const onContract = (contract: any) => {
            if (!scanStartedRef.current || !contract) return;
            if (contract.underlying_symbol && activeMarket?.symbol && contract.underlying_symbol !== activeMarket.symbol) return;
            const contractId = Number(contract.contract_id ?? contract.id);
            if (contractId && seenContractsRef.current.has(contractId)) return;
            if (contractId) seenContractsRef.current.add(contractId);
            setRunCount(count => {
                const next = count + 1;
                if (next % 3 === 0) {
                    setLastCycle(cycle => cycle + 1);
                    setStatus(`3-run cycle complete · refreshed ${definition.name} guidance`);
                }
                return next;
            });
        };
        globalObserver.register('bot.contract', onContract);
        return () => { try { globalObserver.unregister('bot.contract', onContract); } catch {} };
    }, [activeMarket?.symbol, definition.name]);

    useEffect(() => {
        if (bestMarket && !selectedSymbol) {
            setSelectedSymbol(bestMarket.symbol);
            setStatus(`Best market: ${bestMarket.label} · Differs ${bestMarket.differDigit}`);
        }
    }, [bestMarket?.symbol, selectedSymbol]);

    const loadGuided = useCallback(() => {
        if (!activeMarket?.symbol || differDigit === null) return;
        onLoadGuided(botId, activeMarket.symbol, differDigit);
        setStatus(`Loaded ${definition.name} · ${activeMarket.label} · Differs ${differDigit}`);
    }, [activeMarket, botId, definition.name, differDigit, onLoadGuided]);

    return (
        <section className='ai-cycle-guide' aria-label='AI Engine market scanner'>
            <div className='ai-cycle-guide__header'>
                <div>
                    <span className='ai-cycle-guide__eyebrow'>AI ENGINE</span>
                    <h2>Market Scan &amp; Cycle Guide</h2>
                    <p>Authenticated API feed · scans the best market and Differs digit</p>
                </div>
                <span className={`ai-cycle-guide__live ${scanning ? 'is-live' : ''}`}>
                    <i /> {scanning ? 'LIVE' : 'IDLE'}
                </span>
            </div>

            <div className='ai-cycle-guide__bot-tabs'>
                {(Object.keys(DIFFERS_CYCLE_DEFINITIONS) as DiffersCycleBotId[]).map(id => (
                    <button key={id} type='button' className={id === botId ? 'active' : ''} onClick={() => setBotId(id)}>
                        {id === 'differs-edge-scanner' ? 'Differs Edge Scanner' : 'AHMED DIFFERS CYCLE'}
                    </button>
                ))}
            </div>

            <div className='ai-cycle-guide__route'>
                {definition.steps.map((step, index) => (
                    <span key={`${step.label}-${index}`} className={index === runCount % definition.steps.length ? 'active' : ''}>
                        {step.label}
                    </span>
                ))}
                <span className='recovery'>Loss → Even/Odd</span>
            </div>

            <div className='ai-cycle-guide__controls'>
                <button type='button' className='scan-btn' onClick={scanning ? stopScan : startScan}>
                    {scanning ? '⏹ Stop scan' : '⌕ Scan market'}
                </button>
                {onLoadGuided && (
                    <button type='button' className='load-btn' disabled={!entryReady} onClick={loadGuided}>
                        📂 Load &amp; Run when ready
                    </button>
                )}
            </div>

            <div className='ai-cycle-guide__status'>
                <span className={entryReady ? 'ready' : ''} />
                <b>{entryReady ? `Entry met · fire ${currentStep.label}` : status}</b>
            </div>

            <div className='ai-cycle-guide__metrics'>
                <div><small>BEST MARKET</small><strong>{activeMarket?.label ?? 'Collecting…'}</strong></div>
                <div><small>DIFFERS DIGIT</small><strong>{differDigit ?? '—'}</strong></div>
                <div><small>3-RUN CYCLE</small><strong>{runCount % 3}/3</strong></div>
                <div><small>ENTRY</small><strong className={entryReady ? 'positive' : ''}>{entryReady ? 'READY' : 'WATCHING'}</strong></div>
            </div>

            <div className='ai-cycle-guide__hint'>
                {currentStep.label} now · on a win the bot advances through its own matrix; on a loss it checks the parity pattern and recovers with {activeMarket ? 'Even/Odd' : 'the selected'}.
                {lastCycle > 0 && ` Rescanned after cycle ${lastCycle}.`}
            </div>
        </section>
    );
};

export default AiCycleGuide;