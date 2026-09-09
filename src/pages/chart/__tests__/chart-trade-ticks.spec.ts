import {
    clampContractTickCount,
    finiteEpoch,
    getPocEntryEpoch,
    getPocStreamCount,
    getPocTickCount,
    countSettlementEpochs,
    getTickSettlementMode,
} from '../chart-trade-ticks';

describe('chart contract tick reconciliation helpers', () => {
    it('uses the documented entry spot time and keeps legacy compatibility', () => {
        expect(getPocEntryEpoch({ entry_spot_time: 100 })).toBe(100);
        expect(getPocEntryEpoch({ entry_tick_time: 101 })).toBe(101);
        expect(getPocEntryEpoch({ entry_spot_time: 0, entry_tick_time: 0 })).toBeNull();
    });

    it('reads the contract tick count without accepting invalid values', () => {
        expect(getPocTickCount({ tick_count: '3' })).toBe(3);
        expect(getPocTickCount({ tick_count: 0 })).toBe(0);
        expect(getPocTickCount({ tick_count: 'not-a-number' })).toBeNull();
    });

    it('deduplicates POC stream epochs, including tick_time responses', () => {
        expect(getPocStreamCount([
            { tick_time: 100 },
            { tick_time: 100 },
            { tick_time: 101 },
            { epoch: 102 },
        ], 100)).toBe(2);
        expect(getPocStreamCount([
            { tick_time: 99 },
            { tick_time: 100 },
            { tick_time: 101 },
        ], 100)).toBe(1);
    });

    it('skips the leading post-entry quote for 1s and Jump markets', () => {
        expect(getTickSettlementMode('1HZ100V')).toBe('skip-first-after-entry');
        expect(getTickSettlementMode('JD100')).toBe('skip-first-after-entry');
        // Entry=9, produced values 0,1,2,3: skip 0, then T1/T2/T3.
        expect(countSettlementEpochs([9, 10], 9, '1HZ100V')).toBe(0);
        expect(countSettlementEpochs([9, 10, 11], 9, '1HZ100V')).toBe(1);
        expect(countSettlementEpochs([9, 10, 11, 12], 9, '1HZ100V')).toBe(2);
        expect(countSettlementEpochs([9, 10, 11, 12, 13], 9, '1HZ100V')).toBe(3);
        expect(countSettlementEpochs([9, 10, 11, 12, 13], 9, 'JD100')).toBe(3);
        expect(getPocStreamCount([
            { epoch: 9 },
            { epoch: 10 },
            { epoch: 11 },
            { epoch: 12 },
            { epoch: 13 },
        ], 9, '1HZ100V')).toBe(3);
    });

    it('counts plain, Bear, and Bull settlement ticks from entry', () => {
        expect(getTickSettlementMode('R_100')).toBe('include-first-after-entry');
        expect(getTickSettlementMode('RDBEAR')).toBe('include-first-after-entry');
        expect(getTickSettlementMode('RDBULL')).toBe('include-first-after-entry');
        // Entry=9, produced values 0,1,2: T1/T2/T3.
        expect(countSettlementEpochs([9, 10], 9, 'R_100')).toBe(1);
        expect(countSettlementEpochs([9, 10, 11], 9, 'RDBEAR')).toBe(2);
        expect(countSettlementEpochs([9, 10, 11, 12], 9, 'R_100')).toBe(3);
        expect(countSettlementEpochs([9, 10, 11, 12], 9, 'RDBEAR')).toBe(3);
        expect(countSettlementEpochs([9, 10, 11, 12], 9, 'RDBULL')).toBe(3);
    });

    it('does not count public ticks until the contract has an entry anchor', () => {
        expect(countSettlementEpochs([], null, 'R_100')).toBe(0);
        expect(countSettlementEpochs([101, 102], 100, 'R_100')).toBe(2);
    });

    it('falls back to stream length when a response omits per-tick epochs', () => {
        expect(getPocStreamCount([{ tick_display_value: '1' }, { tick_display_value: '2' }])).toBe(2);
    });

    it('clamps a reconciled count to the requested contract duration', () => {
        expect(clampContractTickCount(4.8, 5)).toBe(4);
        expect(clampContractTickCount(9, 5)).toBe(5);
        expect(clampContractTickCount(-1, 5)).toBe(0);
        expect(finiteEpoch('0')).toBeNull();
    });
});