import {
    advanceAutoLabGate,
    createAutoLabGate,
    evaluateAutoLabCandidates,
    getAutoLabDigitStats,
    isAutoLabContractWin,
    type AutoLabMarketWindow,
    type AutoLabStrategySettings,
    type AutoLabTick,
} from './auto-lab-engine';

const settings: AutoLabStrategySettings = {
    ticksWindow: 4,
    thresholdPercent: 70,
    barrier: 4,
    requiredStreak: 3,
    contractType: 'AUTO',
};

const makeTicks = (digits: number[], quotes = digits.map(digit => 100 + digit / 10)): AutoLabTick[] =>
    digits.map((digit, index) => ({
        symbol: 'R_10',
        digit,
        quote: quotes[index],
        epoch: index + 1,
        pip_size: 1,
    }));

const market = (ticks: AutoLabTick[]): AutoLabMarketWindow => ({
    symbol: 'R_10',
    label: 'Volatility 10',
    ticks,
});

describe('Auto Lab strategy signals', () => {
    it('creates a contrarian parity signal after the configured same-parity streak', () => {
        const signals = evaluateAutoLabCandidates('RC Even/Odd', [market(makeTicks([2, 4, 6, 8]))], {
            ...settings,
            requiredStreak: 3,
        });

        expect(signals[0]).toMatchObject({ contract_type: 'DIGITODD', strategy: 'RC Even/Odd' });
    });

    it('selects a threshold-qualified over/under setup', () => {
        const signals = evaluateAutoLabCandidates('RC Over4/Under5', [market(makeTicks([6, 7, 8, 9, 5]))], settings);
        expect(signals[0]).toMatchObject({ contract_type: 'DIGITOVER', barrier: 4 });
    });

    it('selects the dominant parity when the percentage threshold is reached', () => {
        const signals = evaluateAutoLabCandidates('%Even/Odd', [market(makeTicks([0, 2, 4, 6, 8, 0, 2, 1, 3, 5]))], {
            ...settings,
            ticksWindow: 10,
            thresholdPercent: 60,
        });
        expect(signals[0]?.contract_type).toBe('DIGITEVEN');
    });

    it('can signal both matches and differs from the target digit frequency', () => {
        const mostlyDifferent = evaluateAutoLabCandidates('Matches/Differs', [market(makeTicks([1, 2, 4, 5, 6, 7, 8, 9, 0, 2]))], {
            ...settings,
            ticksWindow: 10,
            barrier: 3,
            thresholdPercent: 70,
        });
        const mostlyMatching = evaluateAutoLabCandidates('Matches/Differs', [market(makeTicks([3, 3, 3, 3, 3, 3, 3, 3, 1, 2]))], {
            ...settings,
            ticksWindow: 10,
            barrier: 3,
            thresholdPercent: 70,
        });

        expect(mostlyDifferent[0]?.contract_type).toBe('DIGITDIFF');
        expect(mostlyMatching[0]?.contract_type).toBe('DIGITMATCH');
    });

    it('uses quote momentum for Rise/Fall signals', () => {
        const rising = market(makeTicks([1, 2, 3, 4], [100, 101, 102, 103]));
        const falling = market(makeTicks([1, 2, 3, 4], [103, 102, 101, 100]));

        expect(evaluateAutoLabCandidates('Rise/Fall', [rising], settings)[0]?.contract_type).toBe('CALL');
        expect(evaluateAutoLabCandidates('Rise/Fall', [falling], settings)[0]?.contract_type).toBe('PUT');
    });

    it('overrides the strategy contract when a fixed contract type is selected', () => {
        const signals = evaluateAutoLabCandidates('RC Even/Odd', [market(makeTicks([2, 4, 6, 8]))], {
            ...settings,
            requiredStreak: 3,
            contractType: 'DIGITEVEN',
        });

        expect(signals).toHaveLength(1);
        expect(signals[0]).toMatchObject({ contract_type: 'DIGITEVEN', strategy: 'RC Even/Odd' });
    });

    it('keeps fixed Rise/Fall contracts aligned with quote momentum', () => {
        const rising = market(makeTicks([1, 2, 3, 4], [100, 101, 102, 103]));
        const falling = market(makeTicks([1, 2, 3, 4], [103, 102, 101, 100]));

        expect(evaluateAutoLabCandidates('Rise/Fall', [rising], {
            ...settings,
            contractType: 'CALL',
        })[0]?.contract_type).toBe('CALL');
        expect(evaluateAutoLabCandidates('Rise/Fall', [falling], {
            ...settings,
            contractType: 'PUT',
        })[0]?.contract_type).toBe('PUT');
        expect(evaluateAutoLabCandidates('Rise/Fall', [rising], {
            ...settings,
            contractType: 'PUT',
        })).toHaveLength(0);
        expect(evaluateAutoLabCandidates('Rise/Fall', [falling], {
            ...settings,
            contractType: 'CALL',
        })).toHaveLength(0);
        expect(evaluateAutoLabCandidates('Rise/Fall', [rising], {
            ...settings,
            contractType: 'DIGITEVEN',
        })).toHaveLength(0);
    });

    it('normalizes price barriers to two decimals and rejects collapsed ranges', () => {
        const sample = market(makeTicks([2, 4, 6, 8]));
        const oneTouch = evaluateAutoLabCandidates('RC Even/Odd', [sample], {
            ...settings,
            contractType: 'ONETOUCH',
            contractBarrier: 100.126,
        });
        const range = evaluateAutoLabCandidates('RC Even/Odd', [sample], {
            ...settings,
            contractType: 'RANGE',
            contractBarrier: 100.123,
            secondaryBarrier: 100.124,
        });

        expect(oneTouch[0]?.barrier).toBe(100.13);
        expect(range).toHaveLength(0);
    });

    it('multimarket mode ranks candidates across strategy families and instruments', () => {
        const weak = { ...market(makeTicks([2, 4, 1, 6, 3, 8])), symbol: 'R_25', label: 'Volatility 25' };
        const strong = { ...market(makeTicks([2, 4, 6, 8])), symbol: 'R_10', label: 'Volatility 10' };
        const signals = evaluateAutoLabCandidates('Multimarket', [weak, strong], {
            ...settings,
            requiredStreak: 3,
            contractType: 'DIGITEVEN',
        });

        expect(signals.length).toBeGreaterThan(1);
        expect(signals.some(signal => signal.symbol === 'R_10')).toBe(true);
        expect(signals[0].score).toBeGreaterThanOrEqual(signals[1].score);
    });
});

describe('Auto Lab contract outcomes', () => {
    const exit = (digit: number, quote = 100): AutoLabTick => ({
        symbol: 'R_10',
        digit,
        quote,
        epoch: 2,
        pip_size: 1,
    });

    it.each([
        ['CALL', 4, 101, true],
        ['PUT', 4, 99, true],
        ['DIGITEVEN', 4, 100, true],
        ['DIGITODD', 5, 100, true],
        ['DIGITOVER', 5, 100, true],
        ['DIGITUNDER', 3, 100, true],
        ['DIGITMATCH', 4, 100, true],
        ['DIGITDIFF', 3, 100, true],
    ] as const)('evaluates %s using the actual next tick', (type, digit, quote, expected) => {
        const barrier = type === 'DIGITOVER' ? 4
            : type === 'DIGITUNDER' ? 4
            : type === 'DIGITMATCH' ? 4
            : type === 'DIGITDIFF' ? 4
            : undefined;
        expect(isAutoLabContractWin(type, barrier, exit(digit, quote), 100)).toBe(expected);
    });

    it('treats over/under boundaries strictly and rejects a missing barrier', () => {
        expect(isAutoLabContractWin('DIGITOVER', 4, exit(4), 100)).toBe(false);
        expect(isAutoLabContractWin('DIGITUNDER', 4, exit(4), 100)).toBe(false);
        expect(isAutoLabContractWin('DIGITMATCH', undefined, exit(4), 100)).toBe(false);
    });
});

describe('Auto Lab virtual-trade gate', () => {
    it('requires consecutive virtual losses, then consecutive virtual wins', () => {
        let gate = createAutoLabGate(2, 1);
        gate = advanceAutoLabGate(gate, false, 10, 2, 1);
        expect(gate.phase).toBe('losses');
        gate = advanceAutoLabGate(gate, false, 11, 2, 1);
        expect(gate.phase).toBe('wins');
        gate = advanceAutoLabGate(gate, true, 12, 2, 1);
        expect(gate).toMatchObject({ phase: 'armed', armedEpoch: 12 });
    });

    it('resets the win streak after a virtual loss while waiting for wins', () => {
        let gate = createAutoLabGate(1, 2);
        gate = advanceAutoLabGate(gate, false, 10, 1, 2);
        gate = advanceAutoLabGate(gate, true, 11, 1, 2);
        gate = advanceAutoLabGate(gate, false, 12, 1, 2);
        expect(gate).toMatchObject({ phase: 'wins', consecutiveWins: 0 });
    });

    it('builds a complete zero-filled digit distribution', () => {
        const stats = getAutoLabDigitStats(makeTicks([2, 2, 5]));
        expect(stats).toHaveLength(10);
        expect(stats[2].count).toBe(2);
        expect(stats[2].percent).toBeCloseTo(200 / 3, 10);
        expect(stats[0]).toMatchObject({ count: 0, percent: 0 });
    });
});