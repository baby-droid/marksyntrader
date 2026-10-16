import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Check,
    Clock3,
    Download,
    FileText,
    Fingerprint,
    LockKeyhole,
    LogOut,
    Printer,
    Radio,
    RefreshCw,
    Search,
    ShieldAlert,
    ShieldCheck,
    SlidersHorizontal,
    Target,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { AUTO_LAB_CONTRACT_TYPES, AUTO_LAB_MODES } from '../auto-lab/auto-lab-engine';
import type { AutoLabSettings } from '../auto-lab/AutoLabView';
import type { MoneyPrintAdminAnalytics, MoneyPrintPageData, MoneyPrintPrefs, MoneyPrintRanking } from './money-print-types';
import './MoneyPrintPages.scss';

type PageProps = MoneyPrintPageData;
type MoneyMode = MoneyPrintPrefs['mode'];

const MODE_DETAILS: { id: MoneyMode; title: string; description: string; index: string }[] = [
    { id: 'accumulation', title: 'Accumulation', description: 'A session target with exposure limits.', index: '01' },
    { id: 'challenge', title: 'Challenge', description: 'A personal goal; not a return promise.', index: '02' },
    { id: 'growth', title: 'Growth', description: 'Balance target paced across days.', index: '03' },
    { id: 'earnings', title: 'Hourly earnings', description: 'Pause around a session target.', index: '04' },
    { id: 'sessions', title: 'Scheduled sessions', description: 'Use configured East Africa windows.', index: '05' },
    { id: 'flip', title: 'Auto Flip · demo only', description: 'Experimental and high risk.', index: '06' },
];

const STRATEGY_LABELS: Record<(typeof AUTO_LAB_MODES)[number], string> = {
    Multimarket: 'Multimarket scan',
    'RC Even/Odd': 'Even / Odd cycle',
    'RC Over4/Under5': 'Over / Under',
    '%Even/Odd': 'Even / Odd distribution',
    'Matches/Differs': 'Matches / Differs',
    'Rise/Fall': 'Rise / Fall',
};

const CONTRACT_LABELS: Record<string, string> = {
    AUTO: 'Automatic for this strategy',
    CALL: 'Rise',
    PUT: 'Fall',
    DIGITEVEN: 'Even',
    DIGITODD: 'Odd',
    DIGITOVER: 'Over',
    DIGITUNDER: 'Under',
    DIGITMATCH: 'Matches',
    DIGITDIFF: 'Differs',
    CALLSPREAD: 'Call spread',
    PUTSPREAD: 'Put spread',
    ONETOUCH: 'One touch',
    RANGE: 'Range',
    TICKHIGH: 'High tick',
    TICKLOW: 'Low tick',
    ACCU: 'Accumulator',
    MULTUP: 'Multiplier up',
    MULTDOWN: 'Multiplier down',
    LBFLOATCALL: 'Floating call',
    LBFLOATPUT: 'Floating fall',
    LBHIGHLOW: 'Lookback high / low',
};

const money = (value: number | null | undefined, currency: string) => {
    if (value == null || !Number.isFinite(value)) return '—';
    const amount = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    return currency ? `${amount} ${currency}` : amount;
};

const amount = (value: number | null | undefined, digits = 1) => (
    value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
);

const dateLabel = (value: string) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const getContractLabel = (value: string) => CONTRACT_LABELS[value] ?? value;

function PageIntro({ eyebrow, title, description, meta, metaLabel = 'Workspace' }: {
    eyebrow: string;
    title: string;
    description: string;
    meta?: string;
    metaLabel?: string;
}) {
    return (
        <header className="mp-page-intro">
            <div className="mp-page-intro__copy">
                <span className="mp-page-kicker">{eyebrow}</span>
                <h2>{title}</h2>
                <p>{description}</p>
            </div>
            {meta && <div className="mp-page-intro__aside"><span>{metaLabel}</span><strong>{meta}</strong></div>}
        </header>
    );
}

function Panel({ icon, title, description, meta, className = '', children }: {
    icon: ReactNode;
    title: string;
    description?: string;
    meta?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={`mp-page-panel ${className}`.trim()}>
            <div className="mp-page-panel__head">
                <div className="mp-page-panel__title">
                    <span className="mp-page-panel__icon">{icon}</span>
                    <div><h3>{title}</h3>{description && <p>{description}</p>}</div>
                </div>
                {meta && <small>{meta}</small>}
            </div>
            {children}
        </section>
    );
}

function NumberField({ label, value, onChange, min = 0, max, step = 1, disabled = false, help }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    help?: string;
}) {
    const [draft, setDraft] = useState(String(value));
    const [focused, setFocused] = useState(false);
    useEffect(() => {
        if (!focused) setDraft(String(value));
    }, [focused, value]);
    return (
        <label className="mp-page-field">
            <span>{label}</span>
            <input
                type="number"
                value={draft}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                onFocus={() => setFocused(true)}
                onChange={event => {
                    const next = event.currentTarget.value;
                    setDraft(next);
                    if (next !== '' && Number.isFinite(Number(next))) onChange(Number(next));
                }}
                onBlur={() => {
                    setFocused(false);
                    const parsed = Number(draft);
                    const bounded = draft.trim() && Number.isFinite(parsed)
                        ? Math.max(min, max == null ? parsed : Math.min(max, parsed))
                        : min;
                    setDraft(String(bounded));
                    onChange(bounded);
                }}
            />
            {help && <small className="mp-page-help">{help}</small>}
        </label>
    );
}

function SelectField({ label, value, options, onChange, help }: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    help?: string;
}) {
    return (
        <label className="mp-page-field">
            <span>{label}</span>
            <select value={value} onChange={event => onChange(event.currentTarget.value)}>
                {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {help && <small className="mp-page-help">{help}</small>}
        </label>
    );
}

function Switch({ checked, onChange, title, detail, disabled = false }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    title: string;
    detail?: string;
    disabled?: boolean;
}) {
    return (
        <label className="mp-page-switch">
            <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.currentTarget.checked)} />
            <span className="mp-page-switch__track" />
            <span className="mp-page-switch__copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
        </label>
    );
}

function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'caution' | 'success' }) {
    const Icon = tone === 'caution' ? AlertTriangle : tone === 'success' ? Check : Radio;
    return <div className={`mp-page-inline-note${tone === 'info' ? '' : ` mp-page-inline-note--${tone}`}`}><Icon />{children}</div>;
}

function SettingsPage(props: PageProps) {
    const { settings, prefs, markets, currency, accountIsReal, accountAuthorized, liveAcknowledged, onSetting, onPref, onLiveAcknowledged } = props;
    const marketOptions = [
        { value: 'ALL', label: 'All available synthetic markets' },
        ...markets.map(market => ({ value: market.symbol, label: `${market.label} · ${market.symbol}` })),
    ];
    const contractOptions = [
        { value: 'AUTO', label: getContractLabel('AUTO') },
        ...AUTO_LAB_CONTRACT_TYPES.map(type => ({ value: type, label: getContractLabel(type) })),
    ];
    return (
        <div className="mp-pages">
            <PageIntro eyebrow="01 / Capital controls" title="Trade settings" description="Choose what the scanner may consider, then set the exposure limits that govern every run." meta={accountAuthorized ? money(props.accountBalance, currency) : 'Account unavailable'} metaLabel="Active balance" />
            <div className="mp-page-grid">
                <Panel className="mp-page-panel--span-7" icon={<SlidersHorizontal />} title="Trade parameters" description="Market universe, contract family and entry window." meta="EXECUTION">
                    <div className="mp-page-fields">
                        <SelectField label="Market universe" value={settings.marketSelection} options={marketOptions} onChange={value => onSetting('marketSelection', value)} />
                        <SelectField label="Contract type" value={settings.contractType} options={contractOptions} onChange={value => onSetting('contractType', value as AutoLabSettings['contractType'])} />
                        <NumberField label="Signal window · ticks" value={settings.ticksWindow} min={1} max={1500} onChange={value => onSetting('ticksWindow', value)} />
                        <NumberField label="Signal threshold · %" value={settings.thresholdPercent} min={50} max={100} step={0.1} onChange={value => onSetting('thresholdPercent', value)} />
                        <NumberField label="Required streak" value={settings.requiredStreak} min={1} max={100} onChange={value => onSetting('requiredStreak', value)} />
                        <NumberField label="Base stake · amount" value={settings.stake} min={0.01} step={0.01} disabled={prefs.autoStake} onChange={value => onSetting('stake', value)} help={prefs.autoStake ? 'Fixed stake is bypassed while account-based sizing is enabled.' : `Current fixed entry amount, in ${currency || 'account currency'}.`} />
                    </div>
                    <div className="mp-page-inline-note"><ShieldCheck />Risk limits define the maximum planned exposure; they cannot remove market risk or assure a positive result.</div>
                </Panel>

                <Panel className="mp-page-panel--span-5" icon={<Wallet />} title="Stake sizing" description="Decide how entry size relates to available capital." meta="POSITION SIZE">
                    <div className="mp-page-switch-row">
                        <Switch checked={prefs.autoStake} onChange={value => onPref('autoStake', value)} title="Size stake from balance" detail="Uses the selected risk percentage, subject to the cap." />
                    </div>
                    <div className="mp-page-fields" style={{ marginTop: '.65rem' }}>
                        <NumberField label="Account risk · %" value={prefs.riskPercent} min={0.01} max={100} step={0.1} disabled={!prefs.autoStake} onChange={value => onPref('riskPercent', value)} />
                        <NumberField label="Maximum stake" value={prefs.maxStake} min={0.01} step={0.01} disabled={!prefs.autoStake} onChange={value => onPref('maxStake', value)} />
                    </div>
                    <div className="mp-page-kpis" style={{ marginTop: '.7rem', gridTemplateColumns: '1fr' }}>
                        <div className="mp-page-kpi"><span>Configured entry size</span><strong>{money(prefs.autoStake && props.accountBalance != null ? Math.min(props.accountBalance * prefs.riskPercent / 100, prefs.maxStake) : settings.stake, currency)}</strong></div>
                    </div>
                    <p className="mp-page-disclaimer">The estimate uses the currently supplied balance. It is not an estimate of likely profit.</p>
                </Panel>

                <Panel className="mp-page-panel--span-6" icon={<ShieldAlert />} title="Session boundaries" description="Stop the run when the configured thresholds are reached." meta="LOSS CONTAINMENT">
                    <div className="mp-page-fields">
                        <NumberField label="Take-profit boundary" value={settings.takeProfit} min={0} step={0.01} onChange={value => onSetting('takeProfit', value)} help="Set to 0 to disable." />
                        <NumberField label="Stop-loss boundary" value={settings.stopLoss} min={0} step={0.01} onChange={value => onSetting('stopLoss', value)} help="Set to 0 to disable." />
                        <NumberField label="Max recovery level" value={settings.maxMartingaleLevel} min={0} max={20} onChange={value => onSetting('maxMartingaleLevel', value)} />
                        <NumberField label="Recovery multiplier" value={settings.multiplier} min={1} max={10} step={0.01} onChange={value => onSetting('multiplier', value)} />
                    </div>
                    <div className="mp-page-switch-row" style={{ marginTop: '.68rem' }}>
                        <Switch checked={prefs.martingaleEnabled} onChange={value => onPref('martingaleEnabled', value)} title="Allow recovery progression" detail={`Mode: ${settings.martingaleMode === 'split' ? 'split' : 'normal'} · configured level cap ${settings.maxMartingaleLevel}`} />
                    </div>
                    <div className="mp-page-inline-note mp-page-inline-note--caution"><AlertTriangle />Recovery progression can increase losses quickly. A configured cap does not make a strategy safe.</div>
                </Panel>

                <Panel className="mp-page-panel--span-6" icon={<Clock3 />} title="Live-account confirmation" description="Real-account execution remains explicit and account-level." meta="REAL ACCOUNT">
                    {accountIsReal ? (
                        <>
                            <div className="mp-page-switch-row">
                                <Switch checked={liveAcknowledged} onChange={onLiveAcknowledged} title="I acknowledge live trading risk" detail="Confirm before enabling a real-account run." />
                            </div>
                            <Notice tone={liveAcknowledged ? 'success' : 'caution'}>{liveAcknowledged ? 'Live execution acknowledged for the currently selected account.' : 'Live run controls stay unavailable until you acknowledge real-account risk.'}</Notice>
                        </>
                    ) : (
                        <div className="mp-page-empty"><ShieldCheck /><strong>{accountAuthorized ? 'Demo or unclassified account' : 'No authorized account'}</strong><span>{accountAuthorized ? 'This account is not identified as real. Review the active account in Mark Syn Trader before running.' : 'Connect and authorize an account in Mark Syn Trader to enable account-specific execution.'}</span></div>
                    )}
                    <p className="mp-page-disclaimer">A change of account should always trigger a fresh review of stake, loss boundary and account type.</p>
                </Panel>
            </div>
        </div>
    );
}

function ModesPage({ prefs, goalPlan, currency, onPref, onModeSelect, onSaveGoal, onOpenSettings }: PageProps) {
    const plan = goalPlan;
    const progress = plan.targetBalance > 0 ? Math.max(0, Math.min(100, (plan.startBalance / plan.targetBalance) * 100)) : 0;
    return (
        <div className="mp-pages">
            <PageIntro eyebrow="02 / Objective design" title="Trade modes" description="Set a working objective and inspect the arithmetic before applying it. A plan describes a target, not a forecast." meta={prefs.mode.replace('-', ' ')} metaLabel="Selected mode" />
            <div className="mp-page-grid">
                <Panel className="mp-page-panel--full" icon={<Target />} title="Choose a mode" description="Modes change the operating frame; account risk limits remain in force." meta="OPERATING MODE">
                    <div className="mp-page-mode-list">
                        {MODE_DETAILS.map(item => (
                            <button type="button" key={item.id} className={`mp-page-mode${prefs.mode === item.id ? ' is-active' : ''}`} aria-pressed={prefs.mode === item.id} onClick={() => onModeSelect(item.id)}>
                                <span className="mp-page-mode__index">{item.index}</span><strong>{item.title}</strong><span>{item.description}</span>
                            </button>
                        ))}
                    </div>
                    {prefs.mode === 'flip' && <Notice tone="caution">Auto Flip is experimental and demo-only. It carries elevated risk and does not imply rapid or reliable returns.</Notice>}
                </Panel>
                <Panel className="mp-page-panel--span-6" icon={<SlidersHorizontal />} title="Goal configuration" description="Change the values used for the plan preview." meta="YOUR INPUTS">
                    {prefs.mode === 'challenge' && (
                        <label className="mp-page-field mp-page-field--wide">
                            <span>Challenge description</span>
                            <textarea value={prefs.challenge} onChange={event => onPref('challenge', event.currentTarget.value)} placeholder="Describe the objective you want to track" />
                        </label>
                    )}
                    <div className="mp-page-fields" style={{ marginTop: prefs.mode === 'challenge' ? '.6rem' : 0 }}>
                        <NumberField label="Target balance" value={prefs.goalBalance} min={0.01} step={0.01} onChange={value => onPref('goalBalance', value)} />
                        <NumberField label="Planning horizon · days" value={prefs.days} min={1} max={3650} onChange={value => onPref('days', value)} />
                        {prefs.mode === 'earnings' && <NumberField label="Hourly target" value={prefs.hourlyTarget} min={0} step={0.01} onChange={value => onPref('hourlyTarget', value)} />}
                    </div>
                    {prefs.mode === 'sessions' && (
                        <div className="mp-page-switch-row" style={{ marginTop: '.65rem' }}>
                            <Switch checked={prefs.scheduledSessions} onChange={value => onPref('scheduledSessions', value)} title="Enable scheduled windows" detail="Uses the configured East Africa session windows." />
                        </div>
                    )}
                    <div className="mp-page-actions">
                        <button type="button" className="mp-page-button mp-page-button--quiet" onClick={onOpenSettings}><ShieldCheck /> Review risk limits</button>
                        <button type="button" className="mp-page-button mp-page-button--primary" onClick={onSaveGoal}><Check /> Save goal</button>
                    </div>
                </Panel>
                <Panel className="mp-page-panel--span-6" icon={<TrendingUp />} title="Plan preview" description="Derived from supplied account balance and current risk configuration." meta="ARITHMETIC, NOT FORECAST">
                    <div className="mp-page-plan">
                        <div className="mp-page-plan__top">
                            <div><span>Required daily profit</span><strong>{money(plan.requiredDailyProfit, currency)}</strong></div>
                            <span className={`mp-page-plan__status${plan.planStatus === 'invalid' ? ' is-invalid' : ''}`}>{plan.planStatus === 'goal-reached' ? 'Goal reached' : plan.planStatus === 'ready' ? 'Plan inputs valid' : 'Review inputs'}</span>
                        </div>
                        <div className="mp-page-progress" aria-label={`Balance progress ${amount(progress, 0)} percent`}><i style={{ width: `${progress}%` }} /></div>
                        <div className="mp-page-plan__facts">
                            <div><span>Starting balance</span><strong>{money(plan.startBalance, currency)}</strong></div>
                            <div><span>Target balance</span><strong>{money(plan.targetBalance, currency)}</strong></div>
                            <div><span>Remaining</span><strong>{money(plan.remaining, currency)}</strong></div>
                            <div><span>Daily return required</span><strong>{amount(plan.requiredDailyReturnPercent)}%</strong></div>
                            <div><span>Configured stake</span><strong>{money(plan.stake, currency)}</strong></div>
                            <div><span>Stake as balance risk</span><strong>{plan.stakeRiskPercent == null ? 'Unavailable' : `${amount(plan.stakeRiskPercent)}%`}</strong></div>
                            <div><span>Take-profit boundary</span><strong>{money(plan.takeProfit, currency)}</strong></div>
                            <div><span>Stop-loss boundary</span><strong>{money(plan.stopLoss, currency)}</strong></div>
                            <div><span>Planning horizon</span><strong>{plan.days} days</strong></div>
                            <div><span>Balance needed for configured risk</span><strong>{plan.minimumBalanceForConfiguredRisk == null ? 'Unavailable' : money(plan.minimumBalanceForConfiguredRisk, currency)}</strong></div>
                        </div>
                    </div>
                    <p className="mp-page-disclaimer">Required daily profit is a mathematical target derived from the inputs. It is not a prediction, and a target may be unrealistic or result in loss. Synthetic markets are volatile.</p>
                </Panel>
            </div>
        </div>
    );
}

function MarketsPage({ markets, signal, settings }: PageProps) {
    return (
        <div className="mp-pages">
            <PageIntro eyebrow="03 / Supplied market feed" title="Markets & signals" description="A live scan surface for synthetic instruments. Values below are shown only when supplied by the active feed." meta={`${markets.length} instruments`} metaLabel="Current feed" />
            <Panel className="mp-page-panel--full" icon={<Activity />} title="Current signal" description="Signal quality is descriptive, not a probability of winning." meta="LIVE READ">
                <div className="mp-page-signal">
                    <div className="mp-page-signal__main">
                        <span className="mp-page-signal__label">{signal.market || 'Market unavailable'}</span>
                        <h3>{signal.label || 'Waiting for supplied signal'}</h3>
                        <p>{signal.detail || 'Signal details will appear when the strategy feed provides them.'}</p>
                    </div>
                    <div className="mp-page-signal__score"><strong>{signal.confidence == null ? '—' : `${amount(signal.confidence)}%`}</strong><span>Setup score</span></div>
                </div>
            </Panel>
            <Panel className="mp-page-panel--full" icon={<BarChart3 />} title="Market scanner" description={`Showing supplied quote, last digit and strategy score. Active window: ${settings.ticksWindow} ticks.`} meta="INSTRUMENTS">
                {markets.length ? (
                    <div className="mp-page-table-wrap">
                        <table className="mp-page-table">
                            <thead><tr><th>Market</th><th>Latest quote</th><th>Last digit</th><th>Ticks observed</th><th>Score</th><th>Signal</th></tr></thead>
                            <tbody>{markets.map(market => (
                                <tr key={market.symbol}>
                                    <td><strong>{market.label}</strong><small>{market.symbol}</small></td>
                                    <td>{market.quote == null ? '—' : market.quote}</td>
                                    <td>{market.digit ?? '—'}</td>
                                    <td>{market.tickCount}</td>
                                    <td>{market.score == null ? '—' : `${amount(market.score)}%`}</td>
                                    <td><span className={`mp-page-pill${market.signal ? ' mp-page-pill--active' : ''}`}>{market.signal || 'No signal'}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                ) : (
                    <div className="mp-page-empty"><Radio /><strong>No market feed supplied</strong><span>Quotes, digits and signal scores will appear once an authorized synthetic-market feed supplies them. No sample markets are shown.</span></div>
                )}
            </Panel>
        </div>
    );
}

function StrategyPage(props: PageProps) {
    const { settings, prefs, markets, signal, currency, accountAuthorized, accountIsReal, liveAcknowledged, onSetting, onPref, onStart, onLiveAcknowledged } = props;
    const marketOptions = [{ value: 'ALL', label: 'All supplied markets' }, ...markets.map(market => ({ value: market.symbol, label: `${market.label} · ${market.symbol}` }))];
    const contractOptions = [{ value: 'AUTO', label: 'Automatic for selected strategy' }, ...AUTO_LAB_CONTRACT_TYPES.map(type => ({ value: type, label: getContractLabel(type) }))];
    const strategyOptions = AUTO_LAB_MODES.map(mode => ({ value: mode, label: STRATEGY_LABELS[mode] }));
    return (
        <div className="mp-pages">
            <PageIntro eyebrow="04 / Signal configuration" title="Strategy engine" description="Tune the signal rules that screen the supplied feed. A high score does not guarantee a profitable trade." meta={STRATEGY_LABELS[prefs.strategyMode]} metaLabel="Active strategy" />
            <div className="mp-page-grid">
                <Panel className="mp-page-panel--span-6" icon={<Fingerprint />} title="Signal model" description="Select the strategy and the data universe it evaluates." meta="01 / MODEL">
                    <div className="mp-page-fields">
                        <SelectField label="Strategy mode" value={prefs.strategyMode} options={strategyOptions} onChange={value => onPref('strategyMode', value as MoneyPrintPrefs['strategyMode'])} />
                        <SelectField label="Market universe" value={settings.marketSelection} options={marketOptions} onChange={value => onSetting('marketSelection', value)} />
                        <SelectField label="Contract type" value={settings.contractType} options={contractOptions} onChange={value => onSetting('contractType', value as AutoLabSettings['contractType'])} />
                        <NumberField label="Observation window · ticks" value={settings.ticksWindow} min={1} max={1500} onChange={value => onSetting('ticksWindow', value)} />
                        <NumberField label="Minimum signal threshold · %" value={settings.thresholdPercent} min={50} max={100} step={0.1} onChange={value => onSetting('thresholdPercent', value)} />
                        <NumberField label="Required streak" value={settings.requiredStreak} min={1} max={100} onChange={value => onSetting('requiredStreak', value)} />
                    </div>
                </Panel>
                <Panel className="mp-page-panel--span-6" icon={<Target />} title="Contract timing & barriers" description="These are strategy parameters, not claims about market direction." meta="02 / CONDITIONS">
                    <div className="mp-page-fields">
                        <NumberField label="Contract duration" value={settings.duration} min={1} max={100000} onChange={value => onSetting('duration', value)} />
                        <SelectField label="Duration unit" value={settings.durationUnit} options={[{ value: 't', label: 'Ticks' }, { value: 's', label: 'Seconds' }, { value: 'm', label: 'Minutes' }, { value: 'h', label: 'Hours' }, { value: 'd', label: 'Days' }]} onChange={value => onSetting('durationUnit', value as AutoLabSettings['durationUnit'])} />
                        <NumberField label="Barrier digit" value={settings.barrier} min={0} max={9} onChange={value => onSetting('barrier', value)} />
                        <NumberField label="Contract barrier" value={settings.contractBarrier} min={0} max={9} onChange={value => onSetting('contractBarrier', value)} />
                        <NumberField label="Secondary barrier" value={settings.secondaryBarrier} min={0} max={9} onChange={value => onSetting('secondaryBarrier', value)} />
                        <SelectField label="Barrier range" value={settings.barrierRange} options={[{ value: 'tight', label: 'Tight' }, { value: 'middle', label: 'Middle' }, { value: 'wide', label: 'Wide' }]} onChange={value => onSetting('barrierRange', value as AutoLabSettings['barrierRange'])} />
                        <NumberField label="Selected tick" value={settings.selectedTick} min={1} max={100} onChange={value => onSetting('selectedTick', value)} />
                        <NumberField label="Growth rate" value={settings.growthRate} min={0} max={100} step={0.1} onChange={value => onSetting('growthRate', value)} />
                        <NumberField label="Contract multiplier" value={settings.contractMultiplier} min={1} max={10000} step={0.1} onChange={value => onSetting('contractMultiplier', value)} />
                    </div>
                    <div className="mp-page-switch-row" style={{ marginTop: '.68rem' }}>
                        <Switch checked={settings.autoBarrier} onChange={value => onSetting('autoBarrier', value)} title="Automatic barrier selection" detail="When supported by the selected mode, the strategy may select a barrier from observed data." />
                    </div>
                </Panel>
                <Panel className="mp-page-panel--span-7" icon={<Radio />} title="Current supplied signal" description="A read-only view of the signal currently passed to Money Print." meta="SIGNAL FEED">
                    <div className="mp-page-signal">
                        <div className="mp-page-signal__main"><span className="mp-page-signal__label">{signal.market || 'Market unavailable'}</span><h3>{signal.label || 'Awaiting signal'}</h3><p>{signal.detail || 'No strategy explanation has been supplied yet.'}</p></div>
                        <div className="mp-page-signal__score"><strong>{signal.confidence == null ? '—' : `${amount(signal.confidence)}%`}</strong><span>Setup score</span></div>
                    </div>
                </Panel>
                <Panel className="mp-page-panel--span-5" icon={<ShieldCheck />} title="Run controls" description="Start a scan using the current controls." meta="EXECUTION">
                    <div className="mp-page-switch-row">
                        <Switch checked={prefs.martingaleEnabled} onChange={value => onPref('martingaleEnabled', value)} title="Recovery progression" detail="Can increase exposure following a loss." />
                    </div>
                    <div className="mp-page-fields" style={{ marginTop: '.55rem' }}>
                        <SelectField label="Recovery style" value={settings.martingaleMode} options={[{ value: 'normal', label: 'Normal' }, { value: 'split', label: 'Split' }]} onChange={value => onSetting('martingaleMode', value as AutoLabSettings['martingaleMode'])} />
                        <NumberField label="Virtual losses before run" value={settings.virtualLossesRequired} min={0} max={20} onChange={value => onSetting('virtualLossesRequired', value)} />
                        <NumberField label="Virtual wins before run" value={settings.virtualWinsRequired} min={0} max={20} onChange={value => onSetting('virtualWinsRequired', value)} />
                    </div>
                    {accountIsReal && <div className="mp-page-switch-row" style={{ marginTop: '.65rem' }}><Switch checked={liveAcknowledged} onChange={onLiveAcknowledged} title="Acknowledge live-account risk" detail="Required before real-account execution." /></div>}
                    <div className="mp-page-actions"><button type="button" className="mp-page-button mp-page-button--primary" disabled={!accountAuthorized || (accountIsReal && !liveAcknowledged)} onClick={onStart}><Activity />Start scan</button></div>
                    {!accountAuthorized && <p className="mp-page-help">Connect and authorize an account before starting.</p>}
                </Panel>
                <Panel className="mp-page-panel--full" icon={<ShieldAlert />} title="Risk note" description="Signal conditions and loss boundaries are independent controls." meta={`STAKE ${money(prefs.autoStake ? props.accountBalance == null ? null : Math.min(props.accountBalance * prefs.riskPercent / 100, prefs.maxStake) : settings.stake, currency)}`}>
                    <Notice tone="caution">The strategy can be wrong, gaps or volatility can affect execution, and configured loss limits may not prevent every loss. Validate settings carefully before running.</Notice>
                </Panel>
            </div>
        </div>
    );
}

function ReportsPage({ trades, currency, onExportReport, onPrintReport }: PageProps) {
    const [filter, setFilter] = useState<'all' | 'WIN' | 'LOSS'>('all');
    const [query, setQuery] = useState('');
    const settled = useMemo(() => trades.filter(trade => trade.status !== 'OPEN'), [trades]);
    const wins = settled.filter(trade => trade.status === 'WIN').length;
    const losses = settled.filter(trade => trade.status === 'LOSS').length;
    const net = settled.reduce((sum, trade) => sum + (Number.isFinite(Number(trade.profit)) ? Number(trade.profit) : 0), 0);
    const filtered = settled.filter(trade => {
        const matchesFilter = filter === 'all' || trade.status === filter;
        const search = `${trade.id} ${trade.market} ${trade.contract}`.toLowerCase();
        return matchesFilter && search.includes(query.trim().toLowerCase());
    });
    return (
        <div className="mp-pages">
            <PageIntro eyebrow="05 / Personal records" title="Settled trade reports" description="Your own settled-trade journal, scoped to the account data supplied to this page. Open contracts are excluded." meta={`${settled.length} settled`} metaLabel="Records supplied" />
            <Panel className="mp-page-panel--full" icon={<FileText />} title="Trade journal" description="Review, search and export your settled records." meta="ACCOUNT JOURNAL">
                <div className="mp-page-kpis mp-page-report-metrics">
                    <div className="mp-page-kpi"><span>Net recorded P/L</span><strong className={net > 0 ? 'is-positive' : net < 0 ? 'is-negative' : ''}>{money(net, currency)}</strong></div>
                    <div className="mp-page-kpi"><span>Wins</span><strong>{wins}</strong></div>
                    <div className="mp-page-kpi"><span>Losses</span><strong>{losses}</strong></div>
                </div>
                <div className="mp-page-toolbar">
                    <div className="mp-page-toolbar__filters" role="group" aria-label="Filter settled trades">
                        {(['all', 'WIN', 'LOSS'] as const).map(option => <button type="button" key={option} className={`mp-page-filter${filter === option ? ' is-active' : ''}`} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option === 'all' ? `All ${settled.length}` : `${option === 'WIN' ? 'Wins' : 'Losses'} ${option === 'WIN' ? wins : losses}`}</button>)}
                    </div>
                    <div className="mp-page-report-heading-actions">
                        <label style={{ position: 'relative', display: 'flex', alignItems: 'center' }}><Search size={13} style={{ position: 'absolute', left: 8, color: '#7893af' }} /><input className="mp-page-search" style={{ paddingLeft: 27 }} aria-label="Search trade records" placeholder="Search market, contract or ID" value={query} onChange={event => setQuery(event.currentTarget.value)} /></label>
                        <button type="button" className="mp-page-button mp-page-button--quiet" onClick={onExportReport}><Download />Export</button>
                        <button type="button" className="mp-page-button mp-page-button--quiet" onClick={onPrintReport}><Printer />Print</button>
                    </div>
                </div>
                {filtered.length ? (
                    <div className="mp-page-table-wrap">
                        <table className="mp-page-table">
                            <thead><tr><th>Settled at</th><th>Market</th><th>Contract</th><th>Stake</th><th>Profit / loss</th><th>Result</th><th>Contract ID</th></tr></thead>
                            <tbody>{filtered.map(trade => (
                                <tr key={trade.id}>
                                    <td>{dateLabel(trade.time)}</td>
                                    <td><strong>{trade.market}</strong></td>
                                    <td>{trade.contract}</td>
                                    <td>{money(trade.stake, currency)}</td>
                                    <td className={trade.profit > 0 ? 'is-positive' : trade.profit < 0 ? 'is-negative' : ''}>{money(trade.profit, currency)}</td>
                                    <td><span className={`mp-page-pill mp-page-pill--${trade.status.toLowerCase()}`}>{trade.status}</span></td>
                                    <td>{trade.id}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                ) : (
                    <div className="mp-page-empty"><FileText /><strong>{settled.length ? 'No matching settled records' : 'No settled records supplied'}</strong><span>{settled.length ? 'Try a different result filter or search term.' : 'This view only displays your own records supplied by the active account journal. No sample trades are displayed.'}</span></div>
                )}
                <p className="mp-page-disclaimer">The journal is a record of supplied results, not a guarantee of future performance.</p>
            </Panel>
        </div>
    );
}

function RankingPanel({ title, items }: { title: string; items: MoneyPrintRanking[] }) {
    return (
        <section className="mp-page-ranking">
            <h4>{title}</h4>
            {items.length ? <ol>{items.map((item, index) => (
                <li key={`${item.label}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><strong title={item.label}>{item.label}</strong><span>{money(item.netProfit, item.currency)}</span></li>
            ))}</ol> : <div className="mp-page-empty" style={{ minHeight: 64, padding: '.55rem' }}><span>No ranking data supplied.</span></div>}
        </section>
    );
}

function AdminAnalytics({ analytics }: { analytics: MoneyPrintAdminAnalytics }) {
    const denominator = analytics.wins + analytics.losses;
    const winRate = denominator ? `${amount(analytics.wins / denominator * 100)}%` : '—';
    return (
        <>
            <div className="mp-page-admin-summary">
                <div className="mp-page-kpi"><span>Active accounts · 10m</span><strong>{analytics.activeAccounts10m}</strong></div>
                <div className="mp-page-kpi"><span>Demo accounts · 10m</span><strong>{analytics.demoAccounts10m}</strong></div>
                <div className="mp-page-kpi"><span>Real accounts · 10m</span><strong>{analytics.realAccounts10m}</strong></div>
                <div className="mp-page-kpi"><span>Settled trades</span><strong>{analytics.settledTrades}</strong></div>
                <div className="mp-page-kpi"><span>Wins / losses</span><strong>{analytics.wins} / {analytics.losses}</strong></div>
                <div className="mp-page-kpi"><span>Aggregate win rate</span><strong>{winRate}</strong></div>
            </div>
            <section className="mp-page-ranking" style={{ marginTop: '.7rem' }}>
                <h4>Net profit by currency</h4>
                {analytics.netProfitByCurrency.length ? (
                    <div className="mp-page-kpis">
                        {analytics.netProfitByCurrency.map(item => <div className="mp-page-kpi" key={item.currency}><span>{item.currency}</span><strong className={item.netProfit > 0 ? 'is-positive' : item.netProfit < 0 ? 'is-negative' : ''}>{money(item.netProfit, item.currency)}</strong></div>)}
                    </div>
                ) : <div className="mp-page-empty" style={{ minHeight: 64, padding: '.55rem' }}><span>No net P/L by currency supplied.</span></div>}
            </section>
            <div className="mp-page-rankings" style={{ marginTop: '.7rem' }}>
                <RankingPanel title="Markets" items={analytics.bestMarkets} />
                <RankingPanel title="Strategies" items={analytics.bestStrategies} />
                <RankingPanel title="Trade types" items={analytics.bestTradeTypes} />
                <RankingPanel title="Barriers" items={analytics.bestBarriers} />
                <RankingPanel title="Durations" items={analytics.bestDurations} />
            </div>
            <p className="mp-page-admin-foot">Last updated {dateLabel(analytics.updatedAt)} · Aggregate platform analytics</p>
        </>
    );
}

function AdminPage({ adminUnlocked, adminLoading, adminError, adminAnalytics, onUnlockAdmin, onLockAdmin, onRefreshAdmin }: PageProps) {
    const [pin, setPin] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState('');
    const unlock = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!pin.trim() || submitting) return;
        setSubmitting(true);
        setFeedback('');
        try {
            const unlocked = await onUnlockAdmin(pin);
            setPin('');
            setFeedback(unlocked ? '' : 'The PIN was not accepted. Try again.');
        } catch {
            setPin('');
            setFeedback('Unlock could not be completed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };
    return (
        <div className="mp-pages">
            <PageIntro eyebrow="06 / Restricted access" title="Admin insights" description="Platform-wide aggregates are shown only after the supplied admin unlock succeeds." meta={adminUnlocked ? 'Unlocked' : 'Locked'} metaLabel="Access state" />
            {!adminUnlocked ? (
                <Panel className="mp-page-panel--full" icon={<LockKeyhole />} title="Admin unlock" description="Enter the authorized PIN to request access. The PIN is never displayed back." meta="ACCESS CONTROL">
                    <form className="mp-page-admin-form" onSubmit={unlock}>
                        <div className="mp-page-fields">
                            <label className="mp-page-field">
                                <span>Admin PIN</span>
                                <input type="password" inputMode="text" autoComplete="current-password" value={pin} onChange={event => setPin(event.currentTarget.value)} aria-label="Admin PIN" placeholder="Enter PIN" />
                            </label>
                        </div>
                        {feedback && <Notice tone="caution">{feedback}</Notice>}
                        {adminError && <Notice tone="caution">{adminError}</Notice>}
                        <div className="mp-page-actions"><button className="mp-page-button mp-page-button--primary" type="submit" disabled={!pin.trim() || submitting}>{submitting ? 'Checking access…' : <><LockKeyhole />Unlock insights</>}</button></div>
                    </form>
                    <p className="mp-page-disclaimer" style={{ textAlign: 'center' }}>Admin analytics are restricted. This screen does not contain a default PIN or preloaded data.</p>
                </Panel>
            ) : (
                <>
                    <Panel className="mp-page-panel--full" icon={<BarChart3 />} title="Aggregate analytics" description="Platform-wide data returned by the authorized admin source. These are not personal account records." meta={adminLoading ? 'UPDATING' : 'ADMIN ONLY'}>
                        <div className="mp-page-actions" style={{ marginTop: 0, marginBottom: '.65rem' }}>
                            <button type="button" className="mp-page-button mp-page-button--quiet" onClick={onRefreshAdmin} disabled={adminLoading}><RefreshCw />Refresh</button>
                            <button type="button" className="mp-page-button mp-page-button--danger" onClick={onLockAdmin}><LogOut />Lock admin view</button>
                        </div>
                        {adminLoading ? (
                            <div className="mp-page-admin-summary" aria-label="Loading aggregate analytics" aria-busy="true">
                                {Array.from({ length: 6 }, (_, index) => <div className="mp-page-kpi" key={index}><span>Loading supplied data</span><strong>—</strong></div>)}
                            </div>
                        ) : adminError ? (
                            <div className="mp-page-empty"><AlertTriangle /><strong>Analytics could not be loaded</strong><span>{adminError}</span><button type="button" className="mp-page-button mp-page-button--quiet" onClick={onRefreshAdmin}><RefreshCw />Try again</button></div>
                        ) : adminAnalytics ? (
                            <AdminAnalytics analytics={adminAnalytics} />
                        ) : (
                            <div className="mp-page-empty"><BarChart3 /><strong>No aggregate data available</strong><span>The admin source has not supplied analytics for this view. No placeholder values are shown.</span></div>
                        )}
                    </Panel>
                </>
            )}
        </div>
    );
}

export default function MoneyPrintPages(props: PageProps) {
    switch (props.page) {
        case 'settings': return <SettingsPage {...props} />;
        case 'modes': return <ModesPage {...props} />;
        case 'markets': return <MarketsPage {...props} />;
        case 'strategy': return <StrategyPage {...props} />;
        case 'reports': return <ReportsPage {...props} />;
        case 'admin': return <AdminPage {...props} />;
        case 'dashboard': return null;
        default: return null;
    }
}
