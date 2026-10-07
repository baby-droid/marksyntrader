import { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    Check,
    Clock3,
    RefreshCw,
    ShieldCheck,
    Signal,
    SlidersHorizontal,
    TrendingUp,
    Wifi,
    WifiOff,
} from 'lucide-react';
import type {
    AutoSignalCandidate,
    AutoSignalFamily,
    AutoSignalMarket,
    AutoSignalsPageProps,
    AutoSignalsSettings,
} from './types';
import NumberField from '@/components/number-field';
import './auto-signals.scss';

const FAMILY_OPTIONS: { value: AutoSignalFamily; label: string; short: string }[] = [
    { value: 'AUTO', label: 'All signals', short: 'AUTO' },
    { value: 'PARITY', label: 'Even / Odd', short: 'PARITY' },
    { value: 'OVER_UNDER', label: 'Over / Under', short: 'BARRIER' },
    { value: 'RISE_FALL', label: 'Rise / Fall', short: 'DIRECTION' },
    { value: 'ONLY_UP_DOWN', label: 'Only Up / Down', short: 'ONLY' },
    { value: 'DIFFERS', label: 'Differs', short: 'DIFFERS' },
    { value: 'MATCHES', label: 'Matches', short: 'MATCHES' },
];

const STRATEGY_FAMILY: Record<string, AutoSignalFamily> = {
    EVEN: 'PARITY',
    ODD: 'PARITY',
    OVER: 'OVER_UNDER',
    UNDER: 'OVER_UNDER',
    RISE: 'RISE_FALL',
    FALL: 'RISE_FALL',
    ONLY_UPS: 'ONLY_UP_DOWN',
    ONLY_DOWNS: 'ONLY_UP_DOWN',
    DIFFERS: 'DIFFERS',
    MATCHES: 'MATCHES',
};

const SETTINGS_FIELDS: {
    key: keyof AutoSignalsSettings;
    label: string;
    hint: string;
    min: number;
    max?: number;
    step: number;
    prefix?: string;
}[] = [
    { key: 'maxRuns', label: 'Runs', hint: '1–10 maximum', min: 1, max: 10, step: 1 },
    { key: 'stake1', label: 'Stake 01', hint: 'Initial amount', min: 0.01, step: 0.01 },
    { key: 'stake2', label: 'Stake 02', hint: 'Second amount', min: 0.01, step: 0.01 },
    { key: 'takeProfit', label: 'Take profit', hint: 'Stop at this gain', min: 0, step: 0.01 },
    { key: 'stopLoss', label: 'Stop loss', hint: 'Maximum drawdown', min: 0, step: 0.01 },
    { key: 'martingale', label: 'Martingale', hint: 'Recovery multiplier', min: 1, step: 0.1 },
];

const numberText = (value: number | null | undefined, digits = 2) =>
    value == null || !Number.isFinite(value) ? '—' : value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

const clockText = (timestamp: number | null | undefined) => {
    if (timestamp == null || !Number.isFinite(timestamp)) return 'Awaiting signal';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const remainingText = (expiresAt: number | null | undefined, now: number) => {
    if (!expiresAt || !Number.isFinite(expiresAt)) return '5:00';
    const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const feedLabel: Record<AutoSignalMarket['feedState'], string> = {
    loading: 'Warming',
    live: 'Live feed',
    stale: 'Delayed',
    error: 'Feed issue',
    unavailable: 'Unavailable',
};

const stateLabel: Record<AutoSignalCandidate['state'], string> = {
    warming: 'WARMING',
    unavailable: 'UNAVAILABLE',
    'no-signal': 'NO SIGNAL',
    watch: 'WATCH',
    setup: 'SETUP',
    ready: 'READY',
    expired: 'EXPIRED',
};

function getFamily(market: AutoSignalMarket): AutoSignalFamily {
    return market.candidate ? STRATEGY_FAMILY[market.candidate.strategy] || 'AUTO' : 'AUTO';
}

function WindowConfidence({ market }: { market: AutoSignalMarket }) {
    const windows = market.candidate?.windows ?? [];

    if (!windows.length) {
        return (
            <div className='as-window-empty' data-testid={`text-window-state-${market.symbol}`}>
                Window confirmation will appear as ticks arrive.
            </div>
        );
    }

    return (
        <div className='as-windows' aria-label='Tick window confirmations'>
            {windows.map((item) => (
                <div className={`as-window ${item.agrees ? 'is-agree' : 'is-diverge'}`} key={item.window}>
                    <div className='as-window__top'>
                        <span>{item.window}T</span>
                        {item.agrees ? <Check size={12} aria-hidden='true' /> : <span className='as-window__dash'>–</span>}
                    </div>
                    <strong>{Math.round(item.probability)}%</strong>
                    <div className='as-window__track'>
                        <i style={{ width: `${Math.max(0, Math.min(100, item.probability))}%` }} />
                    </div>
                    <small>{item.sampleSize.toLocaleString()} samples</small>
                </div>
            ))}
        </div>
    );
}

function MarketCard({
    market,
    now,
    currency,
    onTrade,
}: {
    market: AutoSignalMarket;
    now: number;
    currency: string;
    onTrade: AutoSignalsPageProps['onTrade'];
}) {
    const candidate = market.candidate;
    const score = Math.max(0, Math.min(100, candidate?.score ?? 0));
    const isLive = market.feedState === 'live';
    const canTrade = Boolean(candidate && candidate.state !== 'expired' && candidate.state !== 'unavailable');
    const canEntry = Boolean(canTrade && candidate?.entryReady);
    const directionUp = ['RISE', 'ONLY_UPS'].includes(candidate?.strategy ?? '');
    const signalTone = candidate?.tier === 'ELITE' || candidate?.tier === 'STRONG' ? 'strong' : 'steady';

    return (
        <article className={`as-market-card as-market-card--${candidate?.state ?? 'no-signal'}`} data-testid={`card-market-${market.symbol}`}>
            <div className='as-market-card__head'>
                <div className='as-market-card__identity'>
                    <span className={`as-market-card__feed ${isLive ? 'is-live' : `is-${market.feedState}`}`} data-testid={`status-feed-${market.symbol}`}>
                        <i />
                        {feedLabel[market.feedState]}
                    </span>
                    <h3 data-testid={`text-market-label-${market.symbol}`}>{market.label}</h3>
                    <span className='as-market-card__marketline'>{market.market} <b>/</b> {market.submarket}</span>
                </div>
                <div className='as-market-card__quote'>
                    <span>LAST QUOTE</span>
                    <strong data-testid={`text-quote-${market.symbol}`}>{numberText(market.latestQuote, 3)}</strong>
                    <small>digit <b data-testid={`text-digit-${market.symbol}`}>{market.latestDigit ?? '—'}</b></small>
                </div>
            </div>

            <div className={`as-signal-strip as-signal-strip--${signalTone}`}>
                <div className='as-signal-strip__main'>
                    <span className='as-overline'>CURRENT READ</span>
                    {candidate ? (
                        <>
                            <strong data-testid={`text-signal-${market.symbol}`}>
                                {candidate.label}
                                {candidate.barrier != null && <em> {candidate.barrier}</em>}
                            </strong>
                            <small>{candidate.contractType}</small>
                        </>
                    ) : (
                        <>
                            <strong className='as-signal-strip__idle'>No active setup</strong>
                            <small>{market.error || 'Waiting for multi-window alignment'}</small>
                        </>
                    )}
                </div>
                <div className={`as-signal-state as-signal-state--${candidate?.state ?? 'no-signal'}`} data-testid={`status-signal-${market.symbol}`}>
                    {candidate ? stateLabel[candidate.state] : 'NO SIGNAL'}
                </div>
            </div>

            <div className='as-score-line'>
                <div className='as-score-line__label'>
                    <span>CONFLUENCE</span>
                    <strong data-testid={`text-score-${market.symbol}`}>{candidate ? `${Math.round(score)}%` : '—'}</strong>
                </div>
                <div className='as-score-track'><i style={{ width: `${score}%` }} /></div>
                <span className='as-score-line__tier'>{candidate?.tier ?? 'SCANNING'}</span>
            </div>

            <div className={`as-entry-state ${candidate?.entryReady ? 'is-ready' : ''}`} data-testid={`status-entry-${market.symbol}`}>
                <span>ENTRY CONDITION</span>
                <strong>{candidate ? (candidate.entryReady ? 'CONFIRMED' : 'WAITING') : 'NO SETUP'}</strong>
                <small>{candidate?.entryDigit != null ? `Digit ${candidate.entryDigit}` : 'Entry digit —'}</small>
            </div>

            <WindowConfidence market={market} />

            <div className='as-market-card__reason' data-testid={`text-reason-${market.symbol}`}>
                <span className='as-reason-mark'><Activity size={13} aria-hidden='true' /></span>
                <p>{candidate?.reason || 'No candidate has cleared the confirmation windows yet.'}</p>
            </div>

            <div className='as-market-card__meta'>
                <span><Clock3 size={12} aria-hidden='true' /> {candidate?.createdAt ? clockText(candidate.createdAt) : 'No signal time'}</span>
                <span className='as-expiry' data-testid={`text-expiry-${market.symbol}`}>
                    Expires in <b>{remainingText(candidate?.expiresAt, now)}</b>
                </span>
            </div>
            <div className='as-revalidation'>
                <span className='as-revalidation__pulse' />
                <span>5-minute signal · revalidated on each tick</span>
                <small>Updated {clockText(market.updatedAt)}</small>
            </div>

            <div className='as-market-card__actions'>
                <button
                    className='as-button as-button--quiet'
                    type='button'
                    disabled={!canTrade}
                    onClick={() => onTrade(market, 'trade-only')}
                    data-testid={`button-trade-only-${market.symbol}`}
                >
                    Trade Only
                </button>
                <button
                    className='as-button as-button--primary'
                    type='button'
                    disabled={!canEntry}
                    onClick={() => onTrade(market, 'entry-trade')}
                    data-testid={`button-entry-trade-${market.symbol}`}
                >
                    {directionUp ? <ArrowUpRight size={15} aria-hidden='true' /> : <ArrowDownRight size={15} aria-hidden='true' />}
                    Entry Trade
                </button>
            </div>
            {candidate && !candidate.entryReady && (
                <p className='as-entry-note' data-testid={`text-entry-wait-${market.symbol}`}>Entry Trade unlocks when the entry condition is confirmed.</p>
            )}
            {!candidate && <p className='as-entry-note'>Trade handoff is available when a signal is active.</p>}
        </article>
    );
}

function SettingsPanel({
    settings,
    currency,
    onSettingsChange,
}: {
    settings: AutoSignalsSettings;
    currency: string;
    onSettingsChange: AutoSignalsPageProps['onSettingsChange'];
}) {
    return (
        <section className='as-settings' aria-labelledby='as-settings-heading'>
            <div className='as-settings__intro'>
                <div className='as-settings__title'>
                    <span className='as-section-index'>01</span>
                    <div>
                        <span className='as-overline'>BOT BUILDER HANDOFF</span>
                        <h2 id='as-settings-heading'>Execution guardrails</h2>
                    </div>
                </div>
                <p>Configure the limits that travel with your selected signal.</p>
            </div>
            <div className='as-settings__fields'>
                {SETTINGS_FIELDS.map((field) => (
                    <label className='as-field' key={field.key}>
                        <span className='as-field__label'>{field.label}</span>
                        <span className='as-field__input'>
                            {field.prefix && <i>{field.prefix}</i>}
                            <NumberField
                                min={field.min}
                                max={field.max}
                                step={field.step}
                                value={settings[field.key]}
                                onCommit={(next) => {
                                    const committed = field.key === 'maxRuns' ? Math.round(next) : next;
                                    onSettingsChange(field.key, committed as AutoSignalsSettings[typeof field.key]);
                                }}
                                aria-label={field.label}
                                data-testid={`input-setting-${field.key}`}
                            />
                            {field.key !== 'maxRuns' && field.key !== 'martingale' && <i className='as-field__currency'>{currency}</i>}
                        </span>
                        <small>{field.hint}</small>
                    </label>
                ))}
            </div>
            <div className='as-settings__foot'>
                <ShieldCheck size={15} aria-hidden='true' />
                <span>Limits apply in Bot Builder. Signals never place trades.</span>
            </div>
        </section>
    );
}

const AutoSignalsPage = ({
    connected,
    authorized,
    status,
    message,
    markets,
    family,
    settings,
    currency,
    displayCurrency,
    activeRun,
    onFamilyChange,
    onSettingsChange,
    onRefresh,
    onTrade,
}: AutoSignalsPageProps) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, []);

    const visibleMarkets = useMemo(
        () => family === 'AUTO' ? markets : markets.filter((market) => getFamily(market) === family),
        [family, markets],
    );
    const readyCount = markets.filter((market) => market.candidate?.state === 'ready').length;
    const liveCount = markets.filter((market) => market.feedState === 'live').length;
    const statusText = status === 'error' ? 'Scanner issue' : status === 'loading' ? 'Starting scanner' : status === 'scanning' ? 'Scanning markets' : 'Scanner idle';
    const currencyLabel = displayCurrency || currency || 'USD';

    return (
        <main className='auto-signals' data-testid='page-auto-signals'>
            <header className='as-header'>
                <div className='as-header__brand'>
                    <div className='as-brand-mark' aria-hidden='true'><Signal size={20} strokeWidth={2.2} /></div>
                    <div>
                        <span className='as-eyebrow'>MARKSYNTRADER <i>/</i> LIVE DERIV SCANNER</span>
                        <h1>AUTO <span>— SIGNALS</span></h1>
                        <p>Read the alignment. Choose the handoff.</p>
                    </div>
                </div>
                <div className='as-header__tools'>
                    <div className={`as-connection ${connected ? 'is-connected' : 'is-disconnected'}`} data-testid='status-connection'>
                        {connected ? <Wifi size={14} aria-hidden='true' /> : <WifiOff size={14} aria-hidden='true' />}
                        <span>{connected ? 'FEED CONNECTED' : 'FEED OFFLINE'}</span>
                    </div>
                    <div className={`as-connection ${authorized ? 'is-authorized' : 'is-restricted'}`} data-testid='status-authorization'>
                        <ShieldCheck size={14} aria-hidden='true' />
                        <span>{authorized ? 'ACCOUNT AUTHORIZED' : 'AUTHORIZATION REQUIRED'}</span>
                    </div>
                    <button
                        className='as-refresh'
                        type='button'
                        onClick={onRefresh}
                        data-testid='button-refresh-scanner'
                        aria-label='Refresh scanner'
                    >
                        <RefreshCw size={15} className={status === 'loading' ? 'is-spinning' : ''} aria-hidden='true' />
                        <span>Refresh</span>
                    </button>
                </div>
            </header>

            <section className='as-overview' aria-label='Scanner overview'>
                <div className='as-overview__status'>
                    <span className={`as-status-led as-status-led--${status}`} />
                    <div>
                        <span className='as-overline'>ENGINE STATUS</span>
                        <strong data-testid='status-scanner'>{statusText}</strong>
                    </div>
                    <small data-testid='text-scanner-message'>{message || 'Watching for stable multi-window confluence.'}</small>
                </div>
                <div className='as-overview__stat'>
                    <span className='as-overline'>MARKETS LIVE</span>
                    <strong data-testid='text-live-markets'>{String(liveCount).padStart(2, '0')}<small> / {String(markets.length).padStart(2, '0')}</small></strong>
                </div>
                <div className='as-overview__stat as-overview__stat--ready'>
                    <span className='as-overline'>READY SIGNALS</span>
                    <strong data-testid='text-ready-signals'>{String(readyCount).padStart(2, '0')}</strong>
                </div>
                <div className='as-overview__stat as-overview__stat--mode'>
                    <span className='as-overline'>HANDOFF MODE</span>
                    <strong>{activeRun ? 'RUN IN PROGRESS' : 'BOT BUILDER'}</strong>
                    <small>{activeRun ? `${activeRun.symbol} · ${activeRun.completedRuns}/${activeRun.maxRuns} runs` : `${currencyLabel} · never auto-executes`}</small>
                </div>
            </section>

            <div className='as-workspace'>
                <SettingsPanel settings={settings} currency={currencyLabel} onSettingsChange={onSettingsChange} />

                <section className='as-scanner' aria-labelledby='as-scanner-heading'>
                    <div className='as-scanner__heading'>
                        <div>
                            <div className='as-section-kicker'><span className='as-section-index'>02</span><span className='as-overline'>MARKET RADAR</span></div>
                            <h2 id='as-scanner-heading'>Signal board <small data-testid='text-market-count'>{visibleMarkets.length} markets</small></h2>
                        </div>
                        <div className='as-scanner__legend'>
                            <span><i className='is-pass' /> aligned</span>
                            <span><i className='is-wait' /> watching</span>
                            <span className='as-scanner__ticks'><Activity size={13} aria-hidden='true' /> tick windows</span>
                        </div>
                    </div>

                    <div className='as-filter-row'>
                        <div className='as-filter-label'><SlidersHorizontal size={14} aria-hidden='true' /> SIGNAL FAMILY</div>
                        <div className='as-filters' role='group' aria-label='Filter signal family'>
                            {FAMILY_OPTIONS.map((option) => (
                                <button
                                    type='button'
                                    className={`as-filter ${family === option.value ? 'is-active' : ''}`}
                                    key={option.value}
                                    onClick={() => onFamilyChange(option.value)}
                                    aria-pressed={family === option.value}
                                    data-testid={`button-family-${option.value.toLowerCase()}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {status === 'error' && (
                        <div className='as-alert' role='status' data-testid='status-scanner-error'>
                            <span><WifiOff size={16} aria-hidden='true' /></span>
                            <div><strong>Scanner needs attention</strong><p>{message || 'Market data is temporarily unavailable.'}</p></div>
                            <button type='button' onClick={onRefresh} data-testid='button-retry-scanner'>Try again</button>
                        </div>
                    )}

                    {visibleMarkets.length > 0 ? (
                        <div className='as-market-grid' data-testid='grid-markets'>
                            {visibleMarkets.map((market) => (
                                <MarketCard
                                    key={market.symbol}
                                    market={market}
                                    now={now}
                                    currency={currencyLabel}
                                    onTrade={onTrade}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className='as-empty' data-testid='empty-markets'>
                            <div className='as-empty__glyph'><TrendingUp size={21} aria-hidden='true' /></div>
                            <span className='as-overline'>NO MATCHING MARKETS</span>
                            <h3>Nothing in this family yet.</h3>
                            <p>Choose another signal family or refresh the scanner to review current markets.</p>
                            <button type='button' className='as-button as-button--quiet' onClick={onRefresh} data-testid='button-empty-refresh'>
                                <RefreshCw size={14} aria-hidden='true' /> Refresh markets
                            </button>
                        </div>
                    )}
                </section>
            </div>

            <footer className='as-footer'>
                <span><span className='as-footer__mark'>M</span> MARKSYNTRADER <b>·</b> AUTO SIGNALS</span>
                <span><span className='as-footer__signal' /> Live market data is informational. Confirm every signal before handoff.</span>
                <span className='as-footer__clock'>LOCAL UPDATE {clockText(now)}</span>
            </footer>
        </main>
    );
};

export default AutoSignalsPage;
