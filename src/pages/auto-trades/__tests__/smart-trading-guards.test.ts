import {
    beginSmartRun,
    invalidateSmartRun,
    isSmartRunActive,
    isSmartRunCurrent,
    normalizeSmartBarrier,
    pickSmartTradeDecision,
    type SmartCardConfig,
} from '../smart-trading-guards';
import { buildProposalRequest } from '@/hooks/useDerivTrade';

const config = (overrides: Partial<SmartCardConfig> = {}): SmartCardConfig => ({
    stake: 5,
    ticks: 1,
    martingale: 1,
    barrier: 5,
    lookback: 3,
    ifValue: 'Rise',
    thenAction: 'Buy Rise',
    bulkEnabled: false,
    bulkCount: 10,
    ...overrides,
});

describe('Smart Trading decisions', () => {
    it.each([
        ['Rise', 'Buy Rise', [1, 2, 3], 'CALL'],
        ['Fall', 'Buy Fall', [8, 7, 6], 'PUT'],
    ])('maps %s to the correct Deriv contract', (condition, action, digits, contract) => {
        const decision = pickSmartTradeDecision(
            'risefall',
            digits,
            config({ ifValue: condition, thenAction: action }),
        );

        expect(decision).toMatchObject({ contract, barrier: null, meetsCondition: true });
    });

    it('requires the complete selected parity streak before entering', () => {
        const even = pickSmartTradeDecision(
            'evenodd',
            [1, 2, 4],
            config({ lookback: 3, ifValue: 'Even', thenAction: 'Buy Even' }),
        );
        const mixed = pickSmartTradeDecision(
            'evenodd',
            [2, 4, 5],
            config({ lookback: 3, ifValue: 'Even', thenAction: 'Buy Even' }),
        );
        const odd = pickSmartTradeDecision(
            'evenodd',
            [1, 3, 5],
            config({ lookback: 3, ifValue: 'Odd', thenAction: 'Buy Odd' }),
        );

        expect(even).toMatchObject({ contract: 'DIGITEVEN', meetsCondition: false });
        expect(mixed.meetsCondition).toBe(false);
        expect(odd).toMatchObject({ contract: 'DIGITODD', meetsCondition: true });
    });

    it('keeps Over and Under barriers inside Deriv exclusive ranges', () => {
        expect(normalizeSmartBarrier(9, 'Buy Over')).toBe(8);
        expect(normalizeSmartBarrier(0, 'Buy Under')).toBe(1);

        const over = pickSmartTradeDecision(
            'overunder',
            [9, 9, 9],
            config({ barrier: 9, lookback: 3, ifValue: 'Over', thenAction: 'Buy Over' }),
        );
        const under = pickSmartTradeDecision(
            'overunder',
            [0, 0, 0],
            config({ barrier: 0, lookback: 3, ifValue: 'Under', thenAction: 'Buy Under' }),
        );

        expect(over).toMatchObject({ contract: 'DIGITOVER', barrier: 8, meetsCondition: true });
        expect(under).toMatchObject({ contract: 'DIGITUNDER', barrier: 1, meetsCondition: true });
    });

    it('uses the repeated digit for Matches and the recent mode for Differs', () => {
        const matches = pickSmartTradeDecision(
            'matchdiffer',
            [7, 7, 7],
            config({ lookback: 3, ifValue: 'Matches', thenAction: 'Buy Matches' }),
        );
        const differs = pickSmartTradeDecision(
            'matchdiffer',
            [1, 1, 2],
            config({ lookback: 3, ifValue: 'Differs', thenAction: 'Buy Differs' }),
        );
        const notDiffers = pickSmartTradeDecision(
            'matchdiffer',
            [1, 1, 1],
            config({ lookback: 3, ifValue: 'Differs', thenAction: 'Buy Differs' }),
        );

        expect(matches).toMatchObject({ contract: 'DIGITMATCH', barrier: 7, meetsCondition: true });
        expect(differs).toMatchObject({ contract: 'DIGITDIFF', barrier: 1, meetsCondition: true });
        expect(notDiffers.meetsCondition).toBe(false);
    });
});

describe('Smart Trading run generation guards', () => {
    it('invalidates an old loop when a card is stopped and started again', () => {
        const tokens = { risefall: 0 };
        const firstRun = beginSmartRun(tokens, 'risefall');

        invalidateSmartRun(tokens, 'risefall');
        const secondRun = beginSmartRun(tokens, 'risefall');

        expect(secondRun).toBeGreaterThan(firstRun);
        expect(isSmartRunCurrent(tokens, 'risefall', firstRun)).toBe(false);
        expect(isSmartRunActive(tokens, 'risefall', firstRun, false)).toBe(false);
        expect(isSmartRunActive(tokens, 'risefall', secondRun, false)).toBe(true);
        expect(isSmartRunActive(tokens, 'risefall', secondRun, true)).toBe(false);
    });
});

describe('Smart Trading proposal execution guards', () => {
    const base = {
        symbol: '1HZ10V',
        duration: 1,
        duration_unit: 't' as const,
        stake: 5,
    };

    it.each([
        ['CALL', undefined],
        ['PUT', undefined],
        ['DIGITEVEN', undefined],
        ['DIGITODD', undefined],
    ])('does not send a barrier for %s', (contract_type, barrier) => {
        const request = buildProposalRequest({ ...base, contract_type, barrier });

        expect(request).not.toHaveProperty('barrier');
    });

    it.each([
        ['DIGITOVER', 8],
        ['DIGITUNDER', 1],
        ['DIGITMATCH', 7],
        ['DIGITDIFF', 7],
    ])('serializes the %s barrier for Deriv', (contract_type, barrier) => {
        const request = buildProposalRequest({ ...base, contract_type, barrier });

        expect(request).toMatchObject({ contract_type, barrier: String(barrier) });
    });
});