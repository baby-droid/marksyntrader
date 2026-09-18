// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import { useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { observer } from 'mobx-react-lite';
import Text from '@/components/shared_ui/text';
import { contract_stages } from '@/constants/contract-stage';
import { useStore } from '@/hooks/useStore';
import { DerivLightEmptyCardboardBoxIcon } from '@deriv/quill-icons/Illustration';
import { Localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import DataList from '../data-list';
import { TCheckedFilters, TFilterMessageValues, TJournalDataListArgs } from './journal.types';
import { JournalItem, JournalLoader, JournalTools } from './journal-components';

// ── Journal Notification Block ────────────────────────────────────────────────
// Renders a pinned signal/notification bar at the top of the journal when
// the bot publishes a 'journal:signal' CustomEvent.
interface JournalSignal {
    id: number;
    type: 'BUY_EVEN' | 'BUY_ODD' | 'BUY_OVER' | 'BUY_UNDER' | 'BUY_CALL' | 'BUY_PUT' | 'BUY_DIFF' | 'CYCLE' | 'SCAN' | 'WIN' | 'LOSS' | 'RECOVERY' | string;
    label: string;
    detail?: string;
    ts: number;
}

const SIGNAL_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
    BUY_EVEN:  { bg: 'rgba(99,102,241,0.18)',   border: '#6366f1', icon: '🟣' },
    BUY_ODD:   { bg: 'rgba(168,85,247,0.18)',   border: '#a855f7', icon: '🟤' },
    BUY_OVER:  { bg: 'rgba(59,130,246,0.18)',   border: '#3b82f6', icon: '⬆️' },
    BUY_UNDER: { bg: 'rgba(6,182,212,0.18)',    border: '#06b6d4', icon: '⬇️' },
    BUY_CALL:  { bg: 'rgba(34,197,94,0.18)',    border: '#22c55e', icon: '📈' },
    BUY_PUT:   { bg: 'rgba(239,68,68,0.18)',    border: '#ef4444', icon: '📉' },
    BUY_DIFF:  { bg: 'rgba(245,158,11,0.18)',   border: '#f59e0b', icon: '↕️' },
    CYCLE:     { bg: 'rgba(167,139,250,0.18)',  border: '#a78bfa', icon: '🔄' },
    SCAN:      { bg: 'rgba(52,211,153,0.12)',   border: '#34d399', icon: '🔍' },
    WIN:       { bg: 'rgba(34,197,94,0.22)',    border: '#16a34a', icon: '🏆' },
    LOSS:      { bg: 'rgba(239,68,68,0.22)',    border: '#dc2626', icon: '❌' },
    RECOVERY:  { bg: 'rgba(251,191,36,0.18)',   border: '#f59e0b', icon: '🔁' },
};

const JournalNotificationBlock = () => {
    const [signals, setSignals] = useState<JournalSignal[]>([]);
    const nextId = useRef(0);

    useEffect(() => {
        const handler = (event: Event) => {
            const { type, label, detail } = (event as CustomEvent).detail ?? {};
            if (!type) return;
            const sig: JournalSignal = { id: nextId.current++, type, label: label ?? type, detail, ts: Date.now() };
            setSignals(prev => [sig, ...prev].slice(0, 8)); // keep last 8
        };
        window.addEventListener('journal:signal' as any, handler);
        return () => window.removeEventListener('journal:signal' as any, handler);
    }, []);

    if (!signals.length) return null;

    return (
        <div style={{
            padding: '6px 8px',
            borderBottom: '1px solid rgba(99,102,241,0.2)',
            display: 'flex', flexDirection: 'column', gap: '4px',
            maxHeight: '160px', overflowY: 'auto',
        }}>
            <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '2px' }}>
                📡 SIGNAL NOTIFICATIONS
            </div>
            {signals.map(sig => {
                const style = SIGNAL_STYLES[sig.type] ?? SIGNAL_STYLES.SCAN;
                return (
                    <div key={sig.id} style={{
                        background: style.bg,
                        border: `1px solid ${style.border}`,
                        borderRadius: '6px',
                        padding: '4px 8px',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        fontSize: '11px', color: '#e0e7ff',
                        animation: 'journal-signal-in 0.25s ease',
                    }}>
                        <span style={{ fontSize: '13px' }}>{style.icon}</span>
                        <span style={{ fontWeight: 700, color: style.border }}>{sig.label}</span>
                        {sig.detail && <span style={{ color: '#9ca3af', fontSize: '10px' }}>{sig.detail}</span>}
                        <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '9px' }}>
                            {new Date(sig.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const MarketDigitLog = () => {
    const [digits, setDigits] = useState<Record<string, { digit: number; epoch?: number }>>({});
    const [analysis, setAnalysis] = useState<any[]>([]);
    const [bestMarket, setBestMarket] = useState<any>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onDigit = (event: Event) => {
            const { symbol, digit, epoch } = (event as CustomEvent).detail ?? {};
            if (!symbol || !Number.isFinite(Number(digit))) return;
            setDigits(previous => ({ ...previous, [symbol]: { digit: Number(digit), epoch } }));
        };
        const onAnalysis = (event: Event) => {
            const item = (event as CustomEvent).detail ?? {};
            if (!item.symbol) return;
            setAnalysis(previous => [{ ...item, time: Date.now() }, ...previous].slice(0, 24));
        };
        const onBestMarket = (event: Event) => setBestMarket((event as CustomEvent).detail ?? null);
        const onLog = () => setVisible(true);
        window.addEventListener('bot:market-digit' as any, onDigit);
        window.addEventListener('bot:king-fisher-analysis' as any, onAnalysis);
        window.addEventListener('king-fisher:best-market' as any, onBestMarket);
        window.addEventListener('journal:log-market-digits' as any, onLog);
        return () => {
            window.removeEventListener('bot:market-digit' as any, onDigit);
            window.removeEventListener('bot:king-fisher-analysis' as any, onAnalysis);
            window.removeEventListener('king-fisher:best-market' as any, onBestMarket);
            window.removeEventListener('journal:log-market-digits' as any, onLog);
        };
    }, []);

    if (!visible && !Object.keys(digits).length && !analysis.length && !bestMarket) return null;
    return (
        <div className='journal__market-digit-log'>
            <div className='journal__market-digit-log-title'>📊 LIVE MARKET DIGIT LOG</div>
            {bestMarket && (
                <div className='journal__market-digit-log-best'>
                    ✅ Best market found: {bestMarket.label} · {bestMarket.group} · score {bestMarket.score}
                </div>
            )}
            {visible && (
                <div className='journal__market-digit-log-grid'>
                    {Object.entries(digits).map(([symbol, value]) => (
                        <span key={symbol}>{symbol}: <strong>{value.digit}</strong></span>
                    ))}
                </div>
            )}
            {analysis.length > 0 && (
                <div className='journal__market-digit-log-analysis'>
                        {analysis.slice(0, 8).map((item, index) => (
                        <div key={`${item.time}-${index}`} className={item.met ? 'is-met' : 'is-not-met'}>
                            {item.symbol} · {item.sequence || item.digit} {item.met ? '✓ logic met' : '✗ logic not met'} · streak {item.streak}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const Journal = observer(() => {
    const { journal, run_panel } = useStore();
    const {
        checked_filters,
        filterMessage,
        filters,
        filtered_messages,
        is_filter_dialog_visible,
        toggleFilterDialog,
        unfiltered_messages,
    } = journal;
    const { is_stop_button_visible, contract_stage } = run_panel;

    const filtered_messages_length = Array.isArray(filtered_messages) && filtered_messages.length;
    const unfiltered_messages_length = Array.isArray(unfiltered_messages) && unfiltered_messages.length;
    const { isDesktop } = useDevice();

    return (
        <div
            className={classnames('journal run-panel-tab__content--no-stat', {
                'run-panel-tab__content': isDesktop,
            })}
            data-testid='dt_mock_journal'
        >
            <JournalTools
                checked_filters={checked_filters}
                filters={filters}
                filterMessage={filterMessage}
                is_filter_dialog_visible={is_filter_dialog_visible}
                toggleFilterDialog={toggleFilterDialog}
            />
            {/* Signal notification blocks — pinned above messages */}
            <JournalNotificationBlock />
            <MarketDigitLog />
            <div className='journal__item-list'>
                {filtered_messages_length ? (
                    <DataList
                        className='journal'
                        data_source={filtered_messages}
                        rowRenderer={(args: TJournalDataListArgs) => <JournalItem {...args} />}
                        keyMapper={(row: TFilterMessageValues) => row.unique_id}
                    />
                ) : (
                    <>
                        {contract_stage >= contract_stages.STARTING &&
                        !!Object.keys(checked_filters as TCheckedFilters).length &&
                        !unfiltered_messages_length &&
                        is_stop_button_visible ? (
                            <JournalLoader is_mobile={!isDesktop} />
                        ) : (
                            <div className='journal-empty'>
                                <DerivLightEmptyCardboardBoxIcon
                                    height='64px'
                                    width='64px'
                                    className='journal-empty__icon icon-general-fill-g-path'
                                    color='secondary'
                                    fill='var(--text-general)'
                                />
                                <Text
                                    as='h4'
                                    size='xs'
                                    weight='bold'
                                    align='center'
                                    color='less-prominent'
                                    lineHeight='s'
                                    className='journal-empty__header'
                                >
                                    <Localize i18n_default_text='There are no messages to display' />
                                </Text>
                                <div className='journal-empty__message'>
                                    <Text size='xxs' color='less-prominent'>
                                        <Localize i18n_default_text='Here are the possible reasons:' />
                                    </Text>
                                    <ul className='journal-empty__list'>
                                        <li>
                                            <Text size='xxs' color='less-prominent'>
                                                <Localize i18n_default_text='The bot is not running' />
                                            </Text>
                                        </li>
                                        <li>
                                            <Text size='xxs' color='less-prominent'>
                                                <Localize i18n_default_text='The stats are cleared' />
                                            </Text>
                                        </li>
                                        <li>
                                            <Text size='xxs' color='less-prominent'>
                                                <Localize i18n_default_text='All messages are filtered out' />
                                            </Text>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
});

export default Journal;
