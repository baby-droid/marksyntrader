import { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, CircleHelp, Pause, Play, Radio, ShieldCheck, Square, Waves } from 'lucide-react';
import { formatMoney, fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { AUTO_LAB_MODES, getAutoLabSupportedContracts, type AutoLabContractChoice, type AutoLabMode } from './auto-lab-engine';
import './auto-lab-view.scss';

export type { AutoLabMode } from './auto-lab-engine';
export type AutoLabStatus = 'idle' | 'connecting' | 'scanning' | 'running' | 'paused' | 'stopped' | 'risk-stopped';

export type AutoLabSettings = {
  marketSelection: string;
  contractType: AutoLabContractChoice;
  stake: number;
  martingaleMode: 'normal' | 'split';
  multiplier: number;
  maxMartingaleLevel: number;
  takeProfit: number;
  stopLoss: number;
  ticksWindow: number;
  thresholdPercent: number;
  barrier: number;
  autoBarrier: boolean;
  contractBarrier: number;
  secondaryBarrier: number;
  requiredStreak: number;
  duration: number;
  durationUnit: 't' | 's' | 'm' | 'h' | 'd';
  contractMultiplier: number;
  growthRate: number;
  barrierRange: 'tight' | 'middle' | 'wide';
  selectedTick: number;
  virtualLossesRequired: number;
  virtualWinsRequired: number;
};

export type AutoLabAccount = {
  connected: boolean;
  authorized: boolean;
  isVirtual: boolean | null;
  balance: number | null;
  currency: string;
  loginId: string;
};

export type AutoLabSignal = {
  label: string;
  detail: string;
  market: string;
  confidence: number | null;
};

export type AutoLabSession = {
  wins: number;
  losses: number;
  trades: number;
  pnl: number;
  currentStake: number;
  lossLevel: number;
  virtualWins: number;
  virtualLosses: number;
  virtualGatePhase: 'losses' | 'wins' | 'armed';
};

export type AutoLabMarket = {
  symbol: string;
  label: string;
  digit: number | null;
  quote: number | null;
  tickCount: number;
  score: number | null;
  signal: string;
};

export type AutoLabDigitStat = { digit: number; count: number; percent: number };
export type AutoLabTrade = {
  id: string;
  time: string;
  market: string;
  contract: string;
  stake: number;
  profit: number;
  status: 'OPEN' | 'WIN' | 'LOSS';
};

export type AutoLabViewProps = {
  mode: AutoLabMode;
  onModeChange: (mode: AutoLabMode) => void;
  settings: AutoLabSettings;
  onSettingChange: (key: keyof AutoLabSettings, value: string | number | boolean) => void;
  account: AutoLabAccount;
  status: AutoLabStatus;
  currentSignal: AutoLabSignal;
  session: AutoLabSession;
  markets: AutoLabMarket[];
  digitStats: AutoLabDigitStat[];
  trades: AutoLabTrade[];
  liveAcknowledged: boolean;
  onLiveAcknowledgedChange: (acknowledged: boolean) => void;
  canStart: boolean;
  inputsDisabled: boolean;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  message: string;
};

const MODES = AUTO_LAB_MODES;

const MODE_LABELS: Record<AutoLabMode, string> = {
  Multimarket: 'Multimarket scan',
  'RC Even/Odd': 'Even / Odd cycle',
  'RC Over4/Under5': 'Over / Under',
  '%Even/Odd': 'Even / Odd distribution',
  'Matches/Differs': 'Matches / Differs',
  'Rise/Fall': 'Rise / Fall',
};

const CONTRACT_LABELS: Record<AutoLabContractChoice, string> = {
  AUTO: 'Automatic for selected strategy',
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
  LBFLOATPUT: 'Floating put',
  LBHIGHLOW: 'Lookback high/low',
};

const MODE_NOTES: Record<AutoLabMode, string> = {
  Multimarket: 'Scan authorized synthetic markets for the strongest available setup.',
  'RC Even/Odd': 'Read recent parity cycles across the selected tick window.',
  'RC Over4/Under5': 'Compare digits against the selected barrier. Choose Over or Under below.',
  '%Even/Odd': 'Evaluate the observed even-to-odd distribution.',
  'Matches/Differs': 'Track digit concentration. The automatic barrier uses the most-observed digit in the supplied tick window.',
  'Rise/Fall': 'Use consecutive quote movement to select Rise or Fall contracts.',
};

const statusLabel: Record<AutoLabStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  scanning: 'Scanning',
  running: 'Running',
  paused: 'Paused',
  stopped: 'Stopped',
  'risk-stopped': 'Risk stopped',
};

const statusTone: Record<AutoLabStatus, string> = {
  idle: 'neutral',
  connecting: 'warn',
  scanning: 'good',
  running: 'good',
  paused: 'warn',
  stopped: 'neutral',
  'risk-stopped': 'bad',
};

const money = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatMoney(value);
};

const displayAmount = (value: number | null | undefined, currency: string) => (
  value == null || !Number.isFinite(value)
    ? '—'
    : `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`
);

const display = (value: number | null | undefined, digits = 2) => (
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
);

const useDisplayCurrency = () => {
  const [, setRevision] = useState(0);
  useEffect(() => subscribeCurrency(() => setRevision(value => value + 1)), []);
  return getDisplayCurrency();
};

const NumericField = ({
  label,
  name,
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  wide = false,
  disabled = false,
}: {
  label: string;
  name: keyof AutoLabSettings;
  value: number;
  onChange: AutoLabViewProps['onSettingChange'];
  step?: number;
  min?: number;
  max?: number;
  wide?: boolean;
  disabled?: boolean;
}) => (
  <NumericFieldInput
    label={label}
    name={name}
    value={value}
    onChange={onChange}
    step={step}
    min={min}
    max={max}
    wide={wide}
    disabled={disabled}
  />
);

const NumericFieldInput = ({
  label,
  name,
  value,
  onChange,
  step,
  min,
  max,
  wide,
  disabled,
}: {
  label: string;
  name: keyof AutoLabSettings;
  value: number;
  onChange: AutoLabViewProps['onSettingChange'];
  step: number;
  min: number;
  max?: number;
  wide: boolean;
  disabled: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(String(value));
  }, [value]);

  return (
    <label className={`lab-field${wide ? ' lab-field--wide' : ''}`}>
      {label}
      <input
        ref={inputRef}
        aria-label={label}
        data-testid={`input-${name}`}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={event => {
          const raw = event.target.value;
          setDraft(raw);
          if (raw === '') return;
          const next = Number(raw);
          if (Number.isFinite(next)) onChange(name, next);
        }}
        onBlur={() => {
          const parsed = Number(draft);
          const next = draft.trim() && Number.isFinite(parsed)
            ? Math.max(min, max == null ? parsed : Math.min(max, parsed))
            : min;
          onChange(name, next);
          setDraft(String(next));
        }}
      />
    </label>
  );
};

const AutoLabView = ({
  mode,
  onModeChange,
  settings,
  onSettingChange,
  account,
  status,
  currentSignal,
  session,
  markets,
  digitStats,
  trades,
  liveAcknowledged,
  onLiveAcknowledgedChange,
  canStart,
  inputsDisabled,
  onStart,
  onPause,
  onStop,
  message,
}: AutoLabViewProps) => {
  const displayCurrency = useDisplayCurrency();
  const isRealAccount = account.isVirtual === false;
  const contract = settings.contractType;
  const isDigitContract = contract.startsWith('DIGIT');
  const isTickDurationOnly = isDigitContract || (contract === 'AUTO' && mode !== 'Rise/Fall');
  const readyToRun = canStart && (!isRealAccount || liveAcknowledged);
  const isActive = status === 'running' || status === 'scanning' || status === 'connecting';
  const settingsLocked = inputsDisabled || status === 'paused';
  const hasSession = session.trades > 0;
  const winRate = hasSession ? (session.wins / session.trades) * 100 : null;
  const accountMode = account.isVirtual == null ? 'Account type unavailable' : account.isVirtual ? 'Demo account' : 'Real account';
  const connectedLabel = account.connected ? (account.authorized ? 'Authorized' : 'Connected · authorize') : 'Disconnected';
  const connectionTone = account.connected && account.authorized ? 'good' : account.connected ? 'warn' : 'bad';

  useEffect(() => {
    if (mode !== 'Matches/Differs' || !settings.autoBarrier || settingsLocked || !digitStats.length) return;
    const mostObserved = digitStats
      .filter(item => Number.isInteger(item.digit) && item.digit >= 0 && item.digit <= 9 && Number.isFinite(item.count))
      .slice()
      .sort((left, right) => right.count - left.count || left.digit - right.digit)[0];
    if (mostObserved && settings.barrier !== mostObserved.digit) {
      onSettingChange('barrier', mostObserved.digit);
    }
  }, [digitStats, mode, onSettingChange, settings.autoBarrier, settings.barrier, settingsLocked]);

  return (
    <main className="auto-lab" data-testid="page-auto-lab">
      <div className="auto-lab__shell">
        <header className="auto-lab__header">
          <div className="auto-lab__identity">
            <div className="auto-lab__mark" aria-hidden="true"><Activity size={21} strokeWidth={1.8} /></div>
            <div>
              <span className="lab-kicker">MARKSYNTRADER / DERIV SYNTHETICS</span>
              <h1 className="auto-lab__title">Auto Lab</h1>
              <p className="auto-lab__subtitle">Signal review · risk-managed execution</p>
            </div>
          </div>
          <div className="auto-lab__header-meta">
            <span className={`lab-chip lab-chip--${connectionTone}`} data-testid="status-account-connection">{connectedLabel}</span>
            <span className={`lab-chip lab-chip--${statusTone[status]}`} data-testid="status-engine">{statusLabel[status]}</span>
          </div>
        </header>

        <div className="auto-lab__grid">
          <section className="auto-lab__rail" aria-label="Strategy and execution settings">
            <section className="lab-panel">
              <div className="auto-lab__section-head">
                <div><span className="auto-lab__section-kicker">01 / Strategy</span><h2 className="auto-lab__section-title">Auto Menu</h2></div>
                <Radio size={17} color="var(--lab-cyan)" aria-hidden="true" />
              </div>
              <div className="lab-mode-list" role="group" aria-label="Signal mode">
                {MODES.map((item, index) => (
                  <button
                    type="button"
                    className={`lab-mode${mode === item ? ' is-active' : ''}`}
                    key={item}
                    aria-pressed={mode === item}
                    data-testid={`button-mode-${index}`}
                    disabled={settingsLocked}
                    onClick={() => onModeChange(item)}
                  >
                    <span>{MODE_LABELS[item]}</span><span className="lab-mode__index">0{index + 1}</span>
                  </button>
                ))}
              </div>
              <p className="lab-help" data-testid="text-mode-description">{MODE_NOTES[mode]}</p>
            </section>

            <section className="lab-panel">
              <div className="auto-lab__section-head">
                <div><span className="auto-lab__section-kicker">02 / Parameters</span><h2 className="auto-lab__section-title">Entry conditions</h2></div>
                <Waves size={17} color="var(--lab-cyan)" aria-hidden="true" />
              </div>
              <div className="lab-field-grid">
                <label className="lab-field lab-field--wide">
                  Market universe
                  <select
                    aria-label="Market universe"
                    data-testid="select-market-selection"
                    value={settings.marketSelection}
                    disabled={settingsLocked}
                    onChange={event => onSettingChange('marketSelection', event.target.value)}
                  >
                    <option value="ALL">All supplied markets</option>
                    {markets.map(market => (
                      <option key={market.symbol} value={market.symbol}>{market.label} · {market.symbol}</option>
                    ))}
                  </select>
                </label>
                <label className="lab-field lab-field--wide">Contract type
                  <select
                    aria-label="Contract type"
                    data-testid="select-contract-type"
                    value={settings.contractType}
                    disabled={settingsLocked}
                    onChange={event => onSettingChange('contractType', event.target.value)}
                  >
                    <option value="AUTO">{CONTRACT_LABELS.AUTO}</option>
                    {getAutoLabSupportedContracts(mode)
                      .map(type => <option key={type} value={type}>{CONTRACT_LABELS[type]}</option>)}
                  </select>
                </label>
                <NumericField label="Tick window" name="ticksWindow" value={settings.ticksWindow} onChange={onSettingChange} min={1} max={1500} disabled={settingsLocked} />
                <NumericField label="Threshold %" name="thresholdPercent" value={settings.thresholdPercent} onChange={onSettingChange} min={50} max={100} step={0.1} disabled={settingsLocked} />
                <NumericField
                  label="Barrier digit"
                  name="barrier"
                  value={settings.barrier}
                  onChange={onSettingChange}
                  min={0}
                  max={9}
                  disabled={settingsLocked || ((mode === 'RC Over4/Under5' || mode === 'Matches/Differs') && settings.autoBarrier)}
                />
                {mode === 'RC Over4/Under5' && (
                  <div className="lab-field lab-field--wide">
                    Over / Under direction
                    <div className="lab-segment lab-segment--three" role="group" aria-label="Over or Under contract">
                      {([
                        ['AUTO', 'Auto'],
                        ['DIGITOVER', 'Over'],
                        ['DIGITUNDER', 'Under'],
                      ] as const).map(([contractType, label]) => (
                        <button
                          type="button"
                          key={contractType}
                          className={settings.contractType === contractType ? 'is-active' : ''}
                          aria-pressed={settings.contractType === contractType}
                          data-testid={`button-contract-${contractType.toLowerCase()}`}
                          disabled={settingsLocked}
                          onClick={() => onSettingChange('contractType', contractType)}
                        >{label}</button>
                      ))}
                    </div>
                    <label className="lab-auto-toggle">
                      <input
                        type="checkbox"
                        checked={settings.autoBarrier}
                        disabled={settingsLocked}
                        data-testid="checkbox-auto-over-under-barrier"
                        onChange={event => onSettingChange('autoBarrier', event.target.checked)}
                      />
                      <span>Auto-select best supported barrier</span>
                    </label>
                    <span className="lab-field__help">
                      {settings.autoBarrier
                        ? 'Checks barriers 0–9 and chooses the highest observed win rate that meets your threshold.'
                        : 'Uses the barrier digit above. Over wins on a digit above it; Under wins below it. A matching digit is a loss.'}
                    </span>
                  </div>
                )}
                {mode === 'Matches/Differs' && (
                  <div className="lab-field lab-field--wide">
                    Barrier selection
                    <label className="lab-auto-toggle">
                      <input
                        type="checkbox"
                        checked={settings.autoBarrier}
                        disabled={settingsLocked}
                        data-testid="checkbox-auto-barrier"
                        onChange={event => onSettingChange('autoBarrier', event.target.checked)}
                      />
                      <span>Auto-select most-observed digit</span>
                    </label>
                    <span className="lab-field__help">
                      {digitStats.length
                        ? `Uses the most frequent digit from the observed ${settings.ticksWindow}-tick window as the barrier.`
                        : 'Waiting for observed digit statistics. Automatic selection applies when the feed is available; turn it off to set the barrier manually.'}
                    </span>
                  </div>
                )}
                <NumericField label="Required streak" name="requiredStreak" value={settings.requiredStreak} onChange={onSettingChange} min={1} max={100} disabled={settingsLocked} />
                <NumericField label="Contract duration" name="duration" value={settings.duration} onChange={onSettingChange} min={1} max={100000} disabled={settingsLocked} />
                <label className="lab-field">Duration unit
                  <select
                    aria-label="Duration unit"
                    data-testid="select-duration-unit"
                    value={isTickDurationOnly ? 't' : settings.durationUnit}
                    disabled={settingsLocked || isTickDurationOnly}
                    onChange={event => onSettingChange('durationUnit', event.target.value)}
                  >
                    <option value="t">Ticks</option>
                    <option value="s">Seconds</option>
                    <option value="m">Minutes</option>
                    <option value="h">Hours</option>
                    <option value="d">Days</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="lab-panel">
              <div className="auto-lab__section-head">
                <div><span className="auto-lab__section-kicker">03 / Exposure</span><h2 className="auto-lab__section-title">Risk controls</h2></div>
                <ShieldCheck size={17} color="var(--lab-mint)" aria-hidden="true" />
              </div>
              <div className="lab-field-grid">
                <NumericField label={`Base stake (${displayCurrency})`} name="stake" value={settings.stake} onChange={onSettingChange} step={0.01} min={fromUsd(0.35)} disabled={settingsLocked} />
                <NumericField label="Multiplier" name="multiplier" value={settings.multiplier} onChange={onSettingChange} step={0.01} min={1} max={10} disabled={settingsLocked} />
                <label className="lab-field lab-field--wide">Martingale mode
                  <div className="lab-segment" role="group" aria-label="Martingale mode">
                    {(['normal', 'split'] as const).map(option => (
                      <button
                        type="button"
                        key={option}
                        className={settings.martingaleMode === option ? 'is-active' : ''}
                        aria-pressed={settings.martingaleMode === option}
                        data-testid={`button-martingale-${option}`}
                        disabled={settingsLocked}
                        onClick={() => onSettingChange('martingaleMode', option)}
                      >{option}</button>
                    ))}
                  </div>
                </label>
                <NumericField label="Max recovery level" name="maxMartingaleLevel" value={settings.maxMartingaleLevel} onChange={onSettingChange} min={0} max={20} disabled={settingsLocked} />
                <NumericField label={`Take profit (${displayCurrency})`} name="takeProfit" value={settings.takeProfit} onChange={onSettingChange} step={0.01} disabled={settingsLocked} />
                <NumericField label={`Stop loss (${displayCurrency})`} name="stopLoss" value={settings.stopLoss} onChange={onSettingChange} step={0.01} disabled={settingsLocked} />
                <NumericField label="Virtual losses before run" name="virtualLossesRequired" value={settings.virtualLossesRequired} onChange={onSettingChange} min={0} max={20} disabled={settingsLocked} />
                <NumericField label="Virtual wins before run" name="virtualWinsRequired" value={settings.virtualWinsRequired} onChange={onSettingChange} min={0} max={20} disabled={settingsLocked} />
              </div>
              <p className="lab-help">Take profit and stop loss use actual settled P/L. Set either limit to 0 to disable it. The virtual gate does not place or report Deriv contracts.</p>
            </section>
          </section>

          <section className="auto-lab__center" aria-label="Live market workspace">
            <section className="lab-panel lab-panel--signal">
              <div className="lab-signal">
                <div>
                  <span className="lab-kicker">Current signal / {currentSignal.market || 'Market unavailable'}</span>
                  <h2 className="lab-signal__headline" data-testid="text-current-signal">{currentSignal.label || 'Waiting for signal'}</h2>
                  <p className="lab-signal__detail" data-testid="text-signal-detail">{currentSignal.detail || 'Signal detail will appear when supplied by the strategy.'}</p>
                  <div className="lab-signal__meta">
                    <span className={`lab-chip lab-chip--${statusTone[status]}`}>{statusLabel[status]}</span>
                    <span className="lab-chip lab-chip--neutral">{MODE_LABELS[mode]}</span>
                  </div>
                </div>
                <div className="lab-signal__confidence">
                  <span>Setup score</span>
                  <strong data-testid="value-signal-confidence">{currentSignal.confidence == null ? '—' : `${display(currentSignal.confidence, 1)}%`}</strong>
                </div>
              </div>
              <div className="lab-command" aria-label="Run controls">
                <button
                  type="button"
                  className="lab-command__btn lab-command__btn--start"
                  data-testid="button-start"
                  disabled={!readyToRun || isActive}
                  onClick={onStart}
                ><Play size={15} fill="currentColor" />{status === 'paused' ? 'Resume run' : 'Start run'}</button>
                <button
                  type="button"
                  className="lab-command__btn lab-command__btn--pause"
                  data-testid="button-pause"
                  disabled={status !== 'running' && status !== 'scanning'}
                  onClick={onPause}
                ><Pause size={15} fill="currentColor" />Pause</button>
                <button
                  type="button"
                  className="lab-command__btn lab-command__btn--stop"
                  data-testid="button-stop"
                  disabled={!isActive && status !== 'paused'}
                  onClick={onStop}
                ><Square size={14} fill="currentColor" />Stop</button>
                {!readyToRun && (
                  <span className="lab-command__readiness"><CircleHelp size={13} />
                    {isRealAccount && !liveAcknowledged
                      ? 'Acknowledge real-account execution to enable a run.'
                      : 'Run unavailable until connection and strategy checks are ready.'}
                  </span>
                )}
              </div>
              {message && <div className="lab-message" role="status" data-testid="text-engine-message"><AlertTriangle size={15} />{message}</div>}
            </section>

            <div className="lab-metrics" aria-label="Session performance">
              <div className="lab-metric"><span className="lab-metric__label">Net P/L</span><strong className={`lab-metric__value ${session.pnl > 0 ? 'is-positive' : session.pnl < 0 ? 'is-negative' : ''}`} data-testid="value-session-pnl">{money(session.pnl)}</strong></div>
              <div className="lab-metric"><span className="lab-metric__label">Win rate</span><strong className="lab-metric__value" data-testid="value-win-rate">{winRate == null ? '—' : `${display(winRate, 1)}%`}</strong></div>
              <div className="lab-metric"><span className="lab-metric__label">Trades</span><strong className="lab-metric__value" data-testid="value-trade-count">{session.trades}</strong></div>
              <div className="lab-metric"><span className="lab-metric__label">W / L</span><strong className="lab-metric__value" data-testid="value-win-loss">{session.wins} / {session.losses}</strong></div>
            </div>

            <section className="lab-panel lab-markets">
              <div className="auto-lab__section-head">
                <div><span className="auto-lab__section-kicker">Live feed / supplied values</span><h2 className="auto-lab__section-title">Market monitor</h2></div>
                <span className="lab-chip lab-chip--neutral"><Activity size={12} />{markets.length} instruments</span>
              </div>
              {markets.length ? (
                <div className="lab-markets__scroll">
                  <table className="lab-market-table">
                    <thead><tr><th>Market</th><th>Latest</th><th>Digit</th><th>Ticks</th><th>Score</th><th>Signal</th></tr></thead>
                    <tbody>
                      {markets.map(market => (
                        <tr key={market.symbol} data-testid={`row-market-${market.symbol}`}>
                          <td><span className="lab-market-table__instrument"><strong>{market.label}</strong><small>{market.symbol}</small></span></td>
                          <td data-testid={`value-quote-${market.symbol}`}>{market.quote == null ? '—' : market.quote}</td>
                          <td className="lab-market-table__digit" data-testid={`value-digit-${market.symbol}`}>{market.digit ?? '—'}</td>
                          <td>{market.tickCount}</td>
                          <td className="lab-market-table__score">{market.score == null ? '—' : `${display(market.score, 1)}%`}</td>
                          <td className="lab-market-table__signal">{market.signal || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="lab-empty" data-testid="empty-markets"><BarChart3 size={23} /><strong>No market feed supplied</strong><span>Market digits and quotes will appear here when the authorized feed is available.</span></div>
              )}
            </section>

            <section className="lab-panel">
              <div className="auto-lab__section-head">
                <div><span className="auto-lab__section-kicker">Digit distribution / supplied values</span><h2 className="auto-lab__section-title">Observed digits</h2></div>
                <span className="lab-chip lab-chip--neutral">Window {settings.ticksWindow} ticks</span>
              </div>
              {digitStats.length ? (
                <div className="lab-digits" data-testid="list-digit-stats">
                  {digitStats.map(item => (
                    <div className="lab-digit" key={item.digit} data-testid={`stat-digit-${item.digit}`}>
                      <span className="lab-digit__number">{item.digit}</span>
                      <span className="lab-digit__bar" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0, Math.min(100, item.percent)) / 100})` }} /></span>
                      <span className="lab-digit__percent">{display(item.percent, 1)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="lab-empty" data-testid="empty-digit-stats"><Waves size={23} /><strong>Distribution not ready</strong><span>Waiting for digit statistics from the current market window.</span></div>
              )}
            </section>
          </section>

          <aside className="auto-lab__aside" aria-label="Account and session details">
            <section className="lab-panel lab-panel--quiet">
              <div className="auto-lab__section-head">
                <div><span className="auto-lab__section-kicker">Authorized account</span><h2 className="auto-lab__section-title">Account</h2></div>
                <span className={`lab-chip lab-chip--${connectionTone}`}>{accountMode}</span>
              </div>
              <dl className="lab-account">
                <div className="lab-account__balance"><dt>Available balance</dt><dd data-testid="value-account-balance">{money(account.balance)}</dd></div>
                <dt>Login ID</dt><dd data-testid="value-account-login">{account.loginId || '—'}</dd>
                <dt>Currency</dt><dd data-testid="value-account-currency">{account.currency || '—'}</dd>
                <dt>Authorization</dt><dd>{account.authorized ? 'Authorized' : 'Not authorized'}</dd>
              </dl>
              {isRealAccount && (
                <div className="lab-risk" style={{ marginTop: '0.8rem' }}>
                  <div className="lab-risk__heading"><AlertTriangle size={15} />Real account execution</div>
                  <p>Trades can affect your real balance. Confirm this account before enabling a run.</p>
                  <label className="lab-check">
                    <input
                      type="checkbox"
                      checked={liveAcknowledged}
                      data-testid="checkbox-live-acknowledged"
                      onChange={event => onLiveAcknowledgedChange(event.target.checked)}
                    />
                    <span>I understand this is a real account.</span>
                  </label>
                </div>
              )}
            </section>

            <section className="lab-panel">
              <div className="auto-lab__section-head">
                <div><span className="auto-lab__section-kicker">Risk telemetry</span><h2 className="auto-lab__section-title">Session guard</h2></div>
                <ShieldCheck size={16} color="var(--lab-amber)" aria-hidden="true" />
              </div>
              <dl className="lab-session-lines">
                <div className="lab-session-line"><dt>Current stake</dt><dd data-testid="value-current-stake">{money(session.currentStake)}</dd></div>
                <div className="lab-session-line"><dt>Recovery level</dt><dd data-testid="value-loss-level">{session.lossLevel}</dd></div>
                <div className="lab-session-line"><dt>Virtual gate</dt><dd>{session.virtualGatePhase === 'armed' ? 'Armed' : session.virtualGatePhase === 'losses' ? `${session.virtualLosses} / ${settings.virtualLossesRequired} losses` : `${session.virtualWins} / ${settings.virtualWinsRequired} wins`}</dd></div>
                <div className="lab-session-line"><dt>Take profit</dt><dd>{displayAmount(settings.takeProfit, displayCurrency)}</dd></div>
                <div className="lab-session-line"><dt>Stop loss</dt><dd>{displayAmount(settings.stopLoss, displayCurrency)}</dd></div>
                <div className="lab-session-line"><dt>Max recovery</dt><dd>{settings.maxMartingaleLevel}</dd></div>
                <div className="lab-session-line"><dt>Martingale</dt><dd>{settings.martingaleMode} · ×{display(settings.multiplier, 2)}</dd></div>
              </dl>
            </section>

            <section className="lab-panel">
              <div className="auto-lab__section-head">
                <div><span className="auto-lab__section-kicker">Session tape</span><h2 className="auto-lab__section-title">Recent trades</h2></div>
                <span className="lab-chip lab-chip--neutral">{trades.length} records</span>
              </div>
              {trades.length ? (
                <div className="lab-trades">
                  {trades.map(trade => (
                    <div className={`lab-trade is-${trade.status.toLowerCase()}`} key={trade.id} data-testid={`row-trade-${trade.id}`}>
                      <span className="lab-trade__time">{trade.time || '—'}</span>
                      <span className="lab-trade__contract"><strong>{trade.contract}</strong><small>{trade.market} · {money(trade.stake)}</small></span>
                      <span className="lab-trade__result"><strong>{trade.status === 'OPEN' ? 'OPEN' : money(trade.profit)}</strong><small>{trade.status}</small></span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="lab-empty" data-testid="empty-trades"><ArrowUpRight size={21} /><strong>No trades in session</strong><span>Trade outcomes supplied by this session will be listed here.</span></div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default AutoLabView;