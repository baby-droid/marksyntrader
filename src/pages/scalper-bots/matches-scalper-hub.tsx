import { useEffect, useState } from 'react';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import './matches-scalper-hub.scss';

export interface MatchesScalperHubProps {
    sessionWins: number;
    sessionProfit: number;
    onOpenBot: (range: '0-5' | '6-9') => void;
    onResetSession: () => void;
}

const rangeOptions = [
    {
        range: '0-5' as const,
        title: 'Match 0–5',
        targets: [0, 1, 2, 3, 4, 5],
        entryRange: '6–9',
        code: 'A',
    },
    {
        range: '6-9' as const,
        title: 'Match 6–9',
        targets: [6, 7, 8, 9],
        entryRange: '0–3',
        code: 'B',
    },
];

const MatchesScalperHub = ({
    sessionWins,
    sessionProfit,
    onOpenBot,
    onResetSession,
}: MatchesScalperHubProps) => {
    const [displayCurrency, setDisplayCurrency] = useState(getDisplayCurrency());
    useEffect(() => subscribeCurrency(() => setDisplayCurrency(getDisplayCurrency())), []);
    const formattedProfit = `${sessionProfit < 0 ? '−' : '+'}${fromUsd(Math.abs(Number.isFinite(sessionProfit) ? sessionProfit : 0)).toFixed(2)} ${displayCurrency}`;

    return (
    <main className="matches-scalper-hub" data-testid="matches-scalper-hub">
        <header className="matches-hub__header">
            <div className="matches-hub__eyebrow">
                <span className="matches-hub__mark" aria-hidden="true">MS / 02</span>
                <span>Digit scalper terminal</span>
            </div>
            <h1>Matches Scalper</h1>
            <p className="matches-hub__intro">
                Select a target range. Entry digits and frequency windows are shown before launch.
            </p>
        </header>

        <section className="matches-hub__session" aria-label="Current session" data-testid="status-session">
            <div className="matches-hub__session-label">
                <span className="matches-hub__signal" aria-hidden="true" />
                <span>Current session</span>
            </div>
            <div className="matches-hub__metrics">
                <div className="matches-hub__metric">
                    <span className="matches-hub__metric-label">Wins</span>
                    <output className="matches-hub__metric-value" data-testid="text-session-wins">
                        {sessionWins}
                    </output>
                </div>
                <div className="matches-hub__metric matches-hub__metric--profit">
                    <span className="matches-hub__metric-label">Session profit</span>
                    <output className="matches-hub__metric-value" data-testid="text-session-profit">
                        {formattedProfit}
                    </output>
                </div>
            </div>
            <button
                className="matches-hub__reset"
                type="button"
                onClick={onResetSession}
                data-testid="button-reset-session"
            >
                Reset session
            </button>
        </section>

        <section className="matches-hub__choices" aria-labelledby="matches-hub-choices-title">
            <div className="matches-hub__section-heading">
                <div>
                    <span className="matches-hub__section-index">01 / SELECT RULE SET</span>
                    <h2 id="matches-hub-choices-title">Choose a match range</h2>
                </div>
                <span className="matches-hub__choice-count" data-testid="status-launch-choice-count">
                    02 available
                </span>
            </div>

            <div className="matches-hub__grid">
                {rangeOptions.map(option => (
                    <button
                        key={option.range}
                        className="matches-hub__choice"
                        type="button"
                        onClick={() => onOpenBot(option.range)}
                        aria-label={`Open ${option.title} bot`}
                        data-testid={`button-open-match-${option.range}`}
                    >
                        <span className="matches-hub__choice-top">
                            <span className="matches-hub__choice-code">RULE {option.code}</span>
                            <span className="matches-hub__choice-arrow" aria-hidden="true">
                                <svg viewBox="0 0 20 20" fill="none">
                                    <path d="M4 10h11M10 5l5 5-5 5" />
                                </svg>
                            </span>
                        </span>
                        <span className="matches-hub__choice-title">{option.title}</span>
                        <span className="matches-hub__choice-subtitle">
                            Match the last digit within the selected target band.
                        </span>
                        <span className="matches-hub__divider" aria-hidden="true" />
                        <span className="matches-hub__rule">
                            <span className="matches-hub__rule-label">Target digits</span>
                            <span className="matches-hub__digits" aria-label={`Target digits ${option.targets.join(', ')}`}>
                                {option.targets.map(digit => (
                                    <span className="matches-hub__digit" key={digit}>{digit}</span>
                                ))}
                            </span>
                        </span>
                        <span className="matches-hub__rule matches-hub__rule--entry">
                            <span className="matches-hub__rule-label">Entry trigger range</span>
                            <span className="matches-hub__entry-range">{option.entryRange}</span>
                        </span>
                        <span className="matches-hub__choice-foot">
                            <span>Frequency scan</span>
                            <span>10 + 20 ticks</span>
                        </span>
                    </button>
                ))}
            </div>
        </section>

        <p className="matches-hub__disclaimer" role="note" data-testid="status-frequency-disclaimer">
            <span className="matches-hub__disclaimer-mark" aria-hidden="true">i</span>
            Frequency scanning can highlight recent patterns; it does not guarantee a win.
        </p>
    </main>
    );
};

export default MatchesScalperHub;
