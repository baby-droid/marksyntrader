import { act, fireEvent, render, screen, within } from '@testing-library/react';
import AutoSignalsPage from './AutoSignalsPage';
import type { AutoSignalMarket, AutoSignalsPageProps } from './types';
import { isASpeedBoostEnabled, setASpeedBoostEnabled } from '@/utils/execution-speed';

const market: AutoSignalMarket = {
    symbol: 'R_10',
    label: 'Volatility 10',
    market: 'synthetic_index',
    submarket: 'random_index',
    tickCount: 100,
    latestDigit: 4,
    latestQuote: 100.24,
    updatedAt: Date.now(),
    feedState: 'live',
    availableContractTypes: ['DIGITOVER'],
    candidate: {
        id: 'R_10:OVER:DIGITOVER:4',
        strategy: 'OVER',
        label: 'Over',
        contractType: 'DIGITOVER',
        barrier: 4,
        direction: 'over',
        score: 76,
        tier: 'STRONG',
        state: 'setup',
        reason: 'Historical one-tick alignment',
        windows: [],
        entryDigit: 7,
        entryReady: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        updatedAt: Date.now(),
        recommendedRuns: 1,
    },
};

const props: AutoSignalsPageProps = {
    connected: true,
    authorized: true,
    status: 'scanning',
    message: 'Scanning live markets',
    markets: [market],
    family: 'AUTO',
    settings: {
        maxRuns: 20,
        stake1: 1,
        stake2: 2,
        takeProfit: 5,
        stopLoss: 10,
        martingale: 2,
    },
    currency: 'USD',
    displayCurrency: 'USD',
    activeRun: null,
    onFamilyChange: () => undefined,
    onSettingsChange: () => undefined,
    onRefresh: () => undefined,
    onTrade: jest.fn(),
};

describe('Auto-Signals trade actions', () => {
    it('exposes the bounded one-purchase-per-tick speed booster and syncs its state', () => {
        setASpeedBoostEnabled(false);
        render(<AutoSignalsPage {...props} />);

        const button = screen.getByTestId('button-auto-signals-speed-boost');
        expect(button).toHaveAttribute('aria-pressed', 'false');
        expect(button).toHaveAccessibleName('A-SPEED BOOST off');

        act(() => fireEvent.click(button));
        expect(isASpeedBoostEnabled()).toBe(true);
        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(button).toHaveAccessibleName('A-SPEED BOOST on');
        expect(button).toHaveAttribute(
            'title',
            'A-SPEED BOOST is on: one purchase per tick, no app-added wait. Deriv and network timing still apply.',
        );

        act(() => setASpeedBoostEnabled(false));
    });

    it('lets both bot buttons start from a live signal before the entry trigger is confirmed', async () => {
        render(<AutoSignalsPage {...props} />);

        const tradeOnly = screen.getByTestId('button-trade-only-R_10-OVER-4') as HTMLButtonElement;
        const entryTrade = screen.getByTestId('button-entry-trade-R_10-OVER-4') as HTMLButtonElement;

        expect(tradeOnly.disabled).toBe(false);
        expect(entryTrade.disabled).toBe(false);

        await act(async () => {
            fireEvent.click(entryTrade);
            await Promise.resolve();
        });
        expect(props.onTrade).toHaveBeenCalledWith(market, 'entry-trade');
    });

    it('offers the current bot and the matching Over DT bot from Trade Only', async () => {
        render(<AutoSignalsPage {...props} />);

        fireEvent.click(screen.getByTestId('button-trade-only-R_10-OVER-4'));
        expect(screen.getByRole('dialog', { name: 'Choose a Over bot for Volatility 10' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Over DT/ }));
        await act(async () => Promise.resolve());

        expect(props.onTrade).toHaveBeenCalledWith(market, 'over-dt');
    });

    it('renders alternative barriers as separate cards and shows the exact 20-tick rate', () => {
        const over4 = {
            ...market.candidate!,
            windows: [{ window: 20 as const, sampleSize: 20, probability: 35, agrees: true }],
        };
        const under7 = {
            ...over4,
            id: 'R_10:UNDER:DIGITUNDER:7',
            strategy: 'UNDER' as const,
            label: 'Under',
            contractType: 'DIGITUNDER',
            barrier: 7,
            direction: 'under' as const,
            windows: [{ window: 20 as const, sampleSize: 20, probability: 50, agrees: true }],
        };
        render(<AutoSignalsPage {...props} markets={[{
            ...market,
            candidate: over4,
            candidates: [over4, under7],
        }]} />);

        expect(screen.getByTestId('card-market-R_10-OVER-4')).toBeInTheDocument();
        expect(screen.getByTestId('card-market-R_10-UNDER-7')).toBeInTheDocument();
        expect(screen.getByTestId('text-confidence-R_10-OVER-4')).toHaveTextContent('35%');
        expect(screen.getByTestId('text-confidence-R_10-UNDER-7')).toHaveTextContent('50%');
    });

    it('sends the candidate from the selected card, not the market default candidate', async () => {
        const over = market.candidate!;
        const differs = {
            ...over,
            id: 'R_10:DIFFERS:DIGITDIFF:3',
            strategy: 'DIFFERS' as const,
            label: 'Differs',
            contractType: 'DIGITDIFF',
            barrier: 3,
            direction: 'differs' as const,
        };
        render(<AutoSignalsPage {...props} family='AUTO' markets={[{
            ...market,
            candidate: over,
            candidates: [over, differs],
        }]} />);

        fireEvent.click(screen.getByTestId('button-trade-only-R_10-DIFFERS-3'));
        const dialog = screen.getByRole('dialog', { name: 'Choose a Differs bot for Volatility 10' });
        fireEvent.click(within(dialog).getByRole('button', {
            name: /Trade Only Load the bot matched to this signal/,
        }));
        await act(async () => Promise.resolve());

        expect(props.onTrade).toHaveBeenCalledWith(
            expect.objectContaining({ candidate: differs }),
            'trade-only',
        );
    });

    it('keeps the alignment score and suggested run count in the analysis panel', () => {
        const suggestedCandidate = {
            ...market.candidate!,
            score: 89,
            recommendedRuns: 4,
        };
        render(<AutoSignalsPage {...props} markets={[{
            ...market,
            candidate: suggestedCandidate,
            candidates: [suggestedCandidate],
        }]} />);

        expect(screen.getByTestId('text-confidence-R_10-OVER-4')).toHaveTextContent('Waiting for 20 ticks');
        expect(screen.getByTestId('text-score-R_10-OVER-4')).toHaveTextContent('89/100');
        expect(screen.getByTestId('text-run-recommendation-R_10-OVER-4')).toHaveTextContent('4');
        expect(screen.getByTestId('panel-bot-settings')).not.toHaveAttribute('open');

        fireEvent.click(screen.getByText('SETTINGS'));
        expect(screen.getByTestId('input-setting-stake1')).toBeInTheDocument();
    });

    it('lets each signal card edit the exact run cap sent to Bot Builder', async () => {
        const suggestedCandidate = {
            ...market.candidate!,
            recommendedRuns: 4,
        };
        render(<AutoSignalsPage {...props} markets={[{
            ...market,
            candidate: suggestedCandidate,
            candidates: [suggestedCandidate],
        }]} />);

        const runInput = screen.getByTestId('input-suggested-runs-R_10-OVER-4');
        expect(runInput).toHaveValue('4');
        fireEvent.change(runInput, { target: { value: '6' } });
        fireEvent.blur(runInput);
        expect(screen.getByTestId('text-run-recommendation-R_10-OVER-4')).toHaveTextContent('6');

        fireEvent.click(screen.getByTestId('button-trade-only-R_10-OVER-4'));
        fireEvent.click(screen.getByRole('button', {
            name: /Trade Only Load the bot matched to this signal/,
        }));
        await act(async () => Promise.resolve());

        expect(props.onTrade).toHaveBeenCalledWith(
            expect.objectContaining({
                candidate: expect.objectContaining({ recommendedRuns: 6 }),
            }),
            'trade-only',
        );
    });

    it('uses the Ahmed Matches bot and passes the edited suggested run count', async () => {
        const matchesCandidate = {
            ...market.candidate!,
            id: 'R_10:MATCHES:DIGITMATCH:7',
            strategy: 'MATCHES' as const,
            label: 'Matches',
            contractType: 'DIGITMATCH',
            barrier: 7,
            direction: 'matches' as const,
            entryDigit: 0,
            entryDigits: [0, 1, 2],
            entryReady: false,
            recommendedRuns: 4,
        };
        const matchesMarket = {
            ...market,
            candidate: matchesCandidate,
            candidates: [matchesCandidate],
        };
        render(<AutoSignalsPage {...props} family='MATCHES' markets={[matchesMarket]} />);

        expect(screen.getByTestId('status-entry-R_10-MATCHES-7'))
            .toHaveTextContent('Entry 0/1/2 → target 7');
        expect(screen.getByTestId('text-entry-wait-R_10-MATCHES-7'))
            .toHaveTextContent('no added app wait');

        const runInput = screen.getByTestId('input-suggested-runs-R_10-MATCHES-7');
        expect(runInput).toHaveValue('4');
        fireEvent.change(runInput, { target: { value: '7' } });
        fireEvent.blur(runInput);
        expect(screen.getByTestId('text-run-recommendation-R_10-MATCHES-7')).toHaveTextContent('7');

        fireEvent.click(screen.getByTestId('button-trade-only-R_10-MATCHES-7'));
        const tradeOnly = screen.getByRole('button', {
            name: /Trade Only Load Ahmed SYN Even\/Odd Market Killer v1\.2 and run it automatically/,
        });
        fireEvent.click(tradeOnly);
        await act(async () => Promise.resolve());

        expect(props.onTrade).toHaveBeenCalledWith(
            expect.objectContaining({
                candidate: expect.objectContaining({ recommendedRuns: 7 }),
            }),
            'trade-only',
        );
    });

    it('shows the one-minute rescan note only for Digit Match', () => {
        const { rerender } = render(<AutoSignalsPage {...props} family='MATCHES' />);

        expect(screen.getByTestId('text-digit-match-scan-cadence')).toHaveTextContent('every minute');
        expect(screen.getByTestId('text-digit-match-scan-cadence')).toHaveTextContent('live ticks update the cards');

        rerender(<AutoSignalsPage {...props} family='AUTO' />);
        expect(screen.queryByTestId('text-digit-match-scan-cadence')).not.toBeInTheDocument();
    });

    it('offers the matching Under DT bot for an Under signal', async () => {
        const under = {
            ...market.candidate!,
            strategy: 'UNDER' as const,
            label: 'Under',
            contractType: 'DIGITUNDER',
            barrier: 2,
            direction: 'under' as const,
        };
        const underMarket = { ...market, candidate: under, candidates: [under] };
        render(<AutoSignalsPage {...props} markets={[underMarket]} />);

        fireEvent.click(screen.getByTestId('button-trade-only-R_10-UNDER-2'));
        fireEvent.click(screen.getByRole('button', { name: /Under DT/ }));
        await act(async () => Promise.resolve());

        expect(props.onTrade).toHaveBeenCalledWith(expect.objectContaining({ candidate: under }), 'under-dt');
    });
});
