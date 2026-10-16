import React, { useId } from 'react';
import {
    AlertTriangle,
    ArrowUpRight,
    BrainCircuit,
    CalendarClock,
    CheckCircle2,
    Download,
    LockKeyhole,
    Play,
    Radio,
    ShieldCheck,
    Target,
} from 'lucide-react';
import './MoneyPrintNeuralLink.scss';

export type ChallengeReport = {
    generatedAt: number;
    verdict: 'PLAN' | 'WAIT' | 'DO NOT TRADE';
    challenge: string;
    summary: string;
    accountContext: {
        accountType: 'Demo' | 'Real' | 'Unknown';
        balance: number | null;
        targetBalance?: number;
        currency: string;
        baseStake: number;
        nextStake: number;
        autoStake: boolean;
        riskPercent: number;
        maxStake: number;
        takeProfit: number;
        stopLoss: number;
        sessionPnl: number;
        strategyMode: string;
        scheduledSessions: boolean;
    } | null;
    route: {
        market: string;
        marketSymbol?: string;
        contract: string;
        contractType?: string;
        strategy?: string;
        entryRule: string;
        targetDigits: number[];
        barrier?: number;
        entryDigit?: number;
        matchKey?: string;
    } | null;
    strategies: string[];
    evidence: string[];
    riskNotes: string[];
    sidePerformance: Array<{
        side: string;
        trades: number;
        wins: number;
        losses: number;
        netProfit: number;
        winRate: number | null;
    }>;
};

export type MatchRoute = {
    symbol: string;
    label: string;
    entryDigit: number;
    targetDigit: number;
    conditionalRate: number;
    baselineRate: number;
    lift: number;
    observations: number;
    confidenceLowerBound: number;
    score: number;
    eligible: boolean;
    latestDigit: number | null;
    tickCount: number;
    reason: string;
};

export type MoneyPrintNeuralLinkProps = {
    challengeBrief: string;
    onChallengeBriefChange: (value: string) => void;
    onAnalyze: () => void;
    analysisBusy: boolean;
    report: ChallengeReport | null;
    onDownloadImage: () => void;
    matches: MatchRoute[];
    selectedMatchKey: string | null;
    onSelectMatch: (match: MatchRoute) => void;
    onAutoMatch: (enabled: boolean) => void;
    autoMatchEnabled: boolean;
    canAutoMatch: boolean;
    autoMatchBlockReason: string;
    scheduledSessions: boolean;
    onScheduledSessionsChange: (enabled: boolean) => void;
    lockUntil: number | null;
    currency: string;
    status: 'idle' | 'connecting' | 'running' | 'scanning' | 'paused' | 'stopped' | 'risk-stopped';
    canStartPlan: boolean;
    planBlockReason: string;
    onStartPlan: () => void;
};

/** Stable key convention for the controlled selectedMatchKey prop. */
export const getMatchRouteKey = (match: MatchRoute) =>
    `${match.symbol}:${match.entryDigit}:${match.targetDigit}`;

const formatNumber = (value: number | null | undefined, digits = 1) =>
    value == null || !Number.isFinite(value)
        ? '—'
        : value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

const formatRate = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value) ? '—' : `${formatNumber(value)}%`;

const formatMoney = (value: number, currency: string) => {
    if (!Number.isFinite(value)) return '—';
    const amount = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    return currency ? `${amount} ${currency}` : amount;
};

const reportDate = (timestamp: number) => {
    if (!Number.isFinite(timestamp)) return 'Date unavailable';
    const date = new Date(timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
};

const verdictContent = (verdict: ChallengeReport['verdict']) => {
    if (verdict === 'WAIT') {
        return {
            tone: 'is-wait',
            label: 'WAIT · NO TRADE',
            Icon: AlertTriangle,
        };
    }
    if (verdict === 'DO NOT TRADE') {
        return {
            tone: 'is-no-trade',
            label: 'DO NOT TRADE',
            Icon: AlertTriangle,
        };
    }
    return {
        tone: 'is-plan',
        label: 'PLAN',
        Icon: CheckCircle2,
    };
};

const lockCopy = (lockUntil: number) => {
    const timestamp = lockUntil < 1_000_000_000_000 ? lockUntil * 1000 : lockUntil;
    if (!Number.isFinite(timestamp)) return 'Engine lock is active.';
    return `Risk lock active until ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)}.`;
};

const MoneyPrintNeuralLink = ({
    challengeBrief,
    onChallengeBriefChange,
    onAnalyze,
    analysisBusy,
    report,
    onDownloadImage,
    matches,
    selectedMatchKey,
    onSelectMatch,
    onAutoMatch,
    autoMatchEnabled,
    canAutoMatch,
    autoMatchBlockReason,
    scheduledSessions,
    onScheduledSessionsChange,
    lockUntil,
    currency,
    status,
    canStartPlan,
    planBlockReason,
    onStartPlan,
}: MoneyPrintNeuralLinkProps) => {
    const id = useId();
    const lockActive = lockUntil != null && Number.isFinite(lockUntil)
        && (lockUntil < 1_000_000_000_000 ? lockUntil * 1000 : lockUntil) > Date.now();
    const selectedMatch = matches.find(match => getMatchRouteKey(match) === selectedMatchKey);
    const availableMatch = Boolean(selectedMatch?.eligible);
    const autoMatchDisabled = !autoMatchEnabled && (!canAutoMatch || !availableMatch);
    const reportVerdict = report ? verdictContent(report.verdict) : null;
    const VerdictIcon = reportVerdict?.Icon;

    return (
        <section className='mp-neural-link' aria-label='Money Print Neural Link challenge report and matches'>
            <div className='mp-neural-link__main'>
                <section className='mp-card' aria-labelledby={`${id}-challenge-title`}>
                    <div className='mp-card-heading'>
                        <div className='mp-card-heading__title'>
                            <span><BrainCircuit aria-hidden='true' /></span>
                            <strong id={`${id}-challenge-title`}>Challenge brief</strong>
                        </div>
                        <small>NEURAL LINK</small>
                    </div>
                    <p className='mp-neural-link__intro'>
                        Your brief is included in the report. Local quantitative checks use authenticated tick history, settled Money Print trades, and risk settings; no external AI is connected and this panel does not place trades.
                    </p>
                    <label className='mp-field' htmlFor={`${id}-brief`}>
                        <span>What should the report assess?</span>
                        <textarea
                            className='mp-neural-link__brief'
                            id={`${id}-brief`}
                            value={challengeBrief}
                            onChange={event => onChallengeBriefChange(event.target.value)}
                            placeholder='Describe your challenge, constraints, and what evidence you want considered.'
                            rows={4}
                        />
                    </label>
                    <div className='mp-neural-link__form-actions'>
                        <span className='mp-neural-link__form-hint'>Review the result and risk notes before deciding what to do.</span>
                        <button
                            type='button'
                            className='mp-button mp-neural-link__analyze'
                            onClick={onAnalyze}
                            disabled={analysisBusy}
                            aria-busy={analysisBusy}
                        >
                            <Target aria-hidden='true' />
                            {analysisBusy ? 'Analyzing…' : 'Send to Neural Link'}
                        </button>
                    </div>
                    <div className='mp-neural-link__disclaimer' role='note'>
                        <AlertTriangle size={14} aria-hidden='true' />
                        <span>Any report or match is historical evidence, not a profit guarantee. Past observations cannot predict the next tick.</span>
                    </div>
                </section>

                <section className='mp-card' aria-labelledby={`${id}-report-title`}>
                    <div className='mp-neural-link__report-head'>
                        <div className='mp-card-heading'>
                            <div className='mp-card-heading__title'>
                                <span><ShieldCheck aria-hidden='true' /></span>
                                <strong id={`${id}-report-title`}>Challenge report</strong>
                            </div>
                         <small>LOCAL QUANT ANALYSIS</small>
                        </div>
                        {report && (
                            <button type='button' className='mp-button mp-button--outline mp-neural-link__export' onClick={onDownloadImage}>
                                <Download aria-hidden='true' />
                                Export image
                            </button>
                        )}
                    </div>

                    {report ? (
                        <>
                            <p className='mp-neural-link__report-meta'>Generated {reportDate(report.generatedAt)}</p>
                            <div className={`mp-neural-link__verdict ${reportVerdict?.tone ?? ''}`} role='status' aria-live='polite'>
                                <span className='mp-neural-link__verdict-mark'>
                                    {VerdictIcon && <VerdictIcon size={16} aria-hidden='true' />}
                                </span>
                                <div className='mp-neural-link__verdict-copy'>
                                    <strong>{reportVerdict?.label}</strong>
                                    <p>{report.summary}</p>
                                </div>
                            </div>

                            <div className='mp-neural-link__data-section'>
                                <h3 className='mp-neural-link__data-title'>Challenge &amp; account context</h3>
                                <p className='mp-neural-link__challenge-copy'>{report.challenge || 'No challenge brief provided.'}</p>
                                {report.accountContext && (
                                    <div className='mp-neural-link__context'>
                                        <span><b>Account</b>{report.accountContext.accountType}</span>
                                        <span><b>Verified balance</b>{formatMoney(report.accountContext.balance ?? NaN, report.accountContext.currency)}</span>
                                        {report.accountContext.targetBalance != null && <span><b>Target balance</b>{formatMoney(report.accountContext.targetBalance, report.accountContext.currency)}</span>}
                                        <span><b>Next stake</b>{formatMoney(report.accountContext.nextStake, report.accountContext.currency)}{report.accountContext.autoStake ? ` · ${report.accountContext.riskPercent}% risk cap` : ' · fixed'}</span>
                                        <span><b>Session TP / SL</b>{formatMoney(report.accountContext.takeProfit, report.accountContext.currency)} / −{formatMoney(report.accountContext.stopLoss, report.accountContext.currency)}</span>
                                        <span><b>Session P/L</b>{formatMoney(report.accountContext.sessionPnl, report.accountContext.currency)}</span>
                                        <span><b>Strategy / schedule</b>{report.accountContext.strategyMode} · {report.accountContext.scheduledSessions ? 'EAT schedule on' : 'manual'}</span>
                                    </div>
                                )}
                            </div>

                            <div className='mp-neural-link__data-section'>
                                <h3 className='mp-neural-link__data-title'>Suggested route</h3>
                                {report.route ? (
                                    <>
                                        <div className='mp-neural-link__route'>
                                            <div><span>Market</span><strong>{report.route.market}</strong></div>
                                            <div><span>Contract</span><strong>{report.route.contract}</strong></div>
                                            <div><span>Entry rule</span><strong>{report.route.entryRule}</strong></div>
                                            <div><span>Target digit{report.route.targetDigits.length === 1 ? '' : 's'}</span><strong>{report.route.targetDigits.join(', ') || '—'}</strong></div>
                                        </div>
                                        <p className='mp-neural-link__target-note'>
                                            {report.route.contractType === 'DIGITMATCH'
                                                ? 'One Deriv DIGITMATCH contract accepts one target digit at a time. A route listing multiple digits is not a single multi-digit contract.'
                                                : 'The plan uses the selected live trade type and must still pass the current risk and signal checks before any order is sent.'}
                                        </p>
                                        <button
                                            type='button'
                                            className='mp-button mp-button--start mp-neural-link__start-plan'
                                            onClick={onStartPlan}
                                            disabled={report.verdict !== 'PLAN' || !canStartPlan}
                                        >
                                            <Play aria-hidden='true' size={15} />
                                            Start this trade plan
                                        </button>
                                        {planBlockReason && <p className='mp-neural-link__engine-note' role='status'>{planBlockReason}</p>}
                                    </>
                                ) : (
                                    <p className='mp-neural-link__performance-empty'>No route was supplied for this report.</p>
                                )}
                            </div>

                            <DataList title='Strategies considered' items={report.strategies} empty='No strategy details supplied.' />
                            <DataList title='Evidence' items={report.evidence} empty='No supporting evidence supplied.' />
                            <DataList title='Risk notes' items={report.riskNotes} empty='No risk notes supplied.' />

                            <div className='mp-neural-link__data-section'>
                                <h3 className='mp-neural-link__data-title'>Side performance</h3>
                                {report.sidePerformance.length ? (
                                    <div className='mp-table-wrap'>
                                        <table className='mp-neural-link__performance'>
                                            <thead>
                                                <tr><th scope='col'>Side</th><th scope='col'>Trades</th><th scope='col'>W / L</th><th scope='col'>Win rate</th><th scope='col'>Net</th></tr>
                                            </thead>
                                            <tbody>
                                                {report.sidePerformance.map((side, index) => (
                                                    <tr key={`${side.side}-${index}`}>
                                                        <td>{side.side}</td>
                                                        <td>{side.trades}</td>
                                                        <td>{side.wins} / {side.losses}</td>
                                                        <td>{formatRate(side.winRate)}</td>
                                                        <td>{formatMoney(side.netProfit, currency)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className='mp-neural-link__performance-empty'>No side-performance records supplied.</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className='mp-neural-link__empty'>
                            <Radio size={21} aria-hidden='true' />
                            <strong>No challenge report yet</strong>
                            <span>When analysis arrives, its verdict, evidence, route, and risk notes will appear here.</span>
                        </div>
                    )}
                </section>
            </div>

            <aside className='mp-neural-link__side' aria-label='Matches and execution controls'>
                <section className='mp-card' aria-labelledby={`${id}-matches-title`}>
                    <div className='mp-card-heading'>
                        <div className='mp-card-heading__title'>
                            <span><Target aria-hidden='true' /></span>
                            <strong id={`${id}-matches-title`}>Matches</strong>
                        </div>
                        <small>{matches.length} SUPPLIED</small>
                    </div>
                    <p className='mp-neural-link__match-head'>Historical digit-pair candidates. Selecting a row only selects it; it does not execute a contract.</p>
                    {matches.length ? (
                        <div className='mp-neural-link__match-list' role='group' aria-label='Available match routes'>
                            {matches.map(match => {
                                const key = getMatchRouteKey(match);
                                const isSelected = key === selectedMatchKey;
                                return (
                                    <button
                                        type='button'
                                        key={key}
                                        className={`mp-neural-link__match${isSelected ? ' is-selected' : ''}${match.eligible ? '' : ' is-ineligible'}`}
                                        aria-pressed={isSelected}
                                        onClick={() => onSelectMatch(match)}
                                    >
                                        <span className='mp-neural-link__match-top'>
                                            <span className='mp-neural-link__instrument'>
                                                <strong>{match.label}</strong>
                                                <small>{match.symbol} · latest digit {match.latestDigit ?? '—'} · {match.tickCount} ticks</small>
                                            </span>
                                            <span className={`mp-neural-link__eligibility${match.eligible ? ' is-eligible' : ''}`}>{match.eligible ? 'ELIGIBLE' : 'INELIGIBLE'}</span>
                                        </span>
                                        <span className='mp-neural-link__match-digits'>
                                            Entry <b className='mp-neural-link__digit'>{match.entryDigit}</b>
                                            <ArrowUpRight size={12} aria-hidden='true' />
                                            Target <b className='mp-neural-link__digit'>{match.targetDigit}</b>
                                        </span>
                                        <span className='mp-neural-link__match-metrics'>
                                            <span><span>Conditional</span><strong>{formatRate(match.conditionalRate)}</strong></span>
                                            <span><span>Baseline</span><strong>{formatRate(match.baselineRate)}</strong></span>
                                            <span><span>Lift</span><strong>{formatRate(match.lift)}</strong></span>
                                            <span><span>Observations</span><strong>{match.observations.toLocaleString()}</strong></span>
                                            <span><span>Lower bound</span><strong>{formatRate(match.confidenceLowerBound)}</strong></span>
                                            <span><span>Score</span><strong>{formatNumber(match.score, 1)}</strong></span>
                                        </span>
                                        <span className='mp-neural-link__reason'>{match.reason}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className='mp-neural-link__empty'>
                            <Radio size={20} aria-hidden='true' />
                            <strong>No match routes supplied</strong>
                            <span>Candidates will appear when the scanner provides historical observations.</span>
                        </div>
                    )}
                    <p className='mp-neural-link__selection-hint'>
                        Match selection key: symbol, entry digit, and target digit. Candidate data is descriptive, not a signal guarantee.
                    </p>
                </section>

                <section className='mp-card' aria-labelledby={`${id}-controls-title`}>
                    <div className='mp-card-heading'>
                        <div className='mp-card-heading__title'>
                            <span><CalendarClock aria-hidden='true' /></span>
                            <strong id={`${id}-controls-title`}>Session &amp; engine</strong>
                        </div>
                        <small>RISK CONTROLLED</small>
                    </div>
                    <div className='mp-neural-link__control'>
                        <label className='mp-neural-link__schedule'>
                            <input
                                type='checkbox'
                                checked={scheduledSessions}
                                disabled={lockActive}
                                onChange={event => onScheduledSessionsChange(event.target.checked)}
                            />
                            <span>
                                <strong>Scheduled sessions</strong>
                                <small>EAT 03–06, 11–13, 16–18, 21–23. Runs the selected strategy; keep this page open.</small>
                            </span>
                        </label>
                        <label className={`mp-neural-link__auto${autoMatchDisabled ? ' is-blocked' : ''}`}>
                            <input
                                type='checkbox'
                                checked={autoMatchEnabled}
                                disabled={autoMatchDisabled}
                                onChange={event => onAutoMatch(event.target.checked)}
                                aria-describedby={`${id}-auto-description`}
                            />
                            <span>
                                <strong>Auto-match through engine</strong>
                                <small id={`${id}-auto-description`}>
                                    This hands the selected route to the existing risk-controlled engine. It does not bypass stake, stop-loss, or account safeguards.
                                </small>
                            </span>
                        </label>
                    </div>
                    {lockActive && (
                        <div className='mp-neural-link__lock' role='status'>
                            <LockKeyhole size={13} aria-hidden='true' />
                            <span>{lockCopy(lockUntil as number)}</span>
                        </div>
                    )}
                    {autoMatchBlockReason && (
                        <p className='mp-neural-link__engine-note' role='status'>{autoMatchBlockReason}</p>
                    )}
                    {!autoMatchBlockReason && !canAutoMatch && (
                        <p className='mp-neural-link__engine-note' role='status'>
                            Auto-match is unavailable in the current engine state ({status.replace('-', ' ')}).
                        </p>
                    )}
                    {!availableMatch && autoMatchEnabled && (
                        <p className='mp-neural-link__engine-note' role='status'>Select an eligible match route before auto-match can be enabled.</p>
                    )}
                    <p className='mp-neural-link__engine-note'>
                        Status: <strong>{status.replace('-', ' ')}</strong>. Match selection alone never starts a run.
                    </p>
                </section>
            </aside>
        </section>
    );
};

const DataList = ({ title, items, empty }: { title: string; items: string[]; empty: string }) => (
    <div className='mp-neural-link__data-section'>
        <h3 className='mp-neural-link__data-title'>{title}</h3>
        {items.length ? (
            <ul className='mp-neural-link__list'>
                {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
            </ul>
        ) : (
            <p className='mp-neural-link__performance-empty'>{empty}</p>
        )}
    </div>
);

export default MoneyPrintNeuralLink;
