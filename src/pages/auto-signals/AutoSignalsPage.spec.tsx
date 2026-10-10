import { act, fireEvent, render, screen } from '@testing-library/react';
import AutoSignalsPage from './AutoSignalsPage';
import type { AutoSignalMarket, AutoSignalsPageProps } from './types';

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
        maxRuns: 1,
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
        const under7 = {
            ...market.candidate!,
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
            candidates: [market.candidate!, under7],
        }]} />);

        expect(screen.getByTestId('card-market-R_10-OVER-4')).toBeInTheDocument();
        expect(screen.getByTestId('card-market-R_10-UNDER-7')).toBeInTheDocument();
        expect(screen.getAllByText('50%')).toHaveLength(1);
    });

    it('offers the matching Under DT bot for an Under signal', async () => {
        const under = {
            ...market.candidate!,
            strategy: 'UNDER' as const,
            label: 'Under',
            contractType: 'DIGITUNDER',
            barrier: 4,
            direction: 'under' as const,
        };
        const underMarket = { ...market, candidate: under, candidates: [under] };
        render(<AutoSignalsPage {...props} markets={[underMarket]} />);

        fireEvent.click(screen.getByTestId('button-trade-only-R_10-UNDER-4'));
        fireEvent.click(screen.getByRole('button', { name: /Under DT/ }));
        await act(async () => Promise.resolve());

        expect(props.onTrade).toHaveBeenCalledWith(expect.objectContaining({ candidate: under }), 'under-dt');
    });
});
