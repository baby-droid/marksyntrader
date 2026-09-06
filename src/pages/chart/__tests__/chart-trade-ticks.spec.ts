import {
    clampContractTickCount,
    finiteEpoch,
    getPocEntryEpoch,
    getPocStreamCount,
    getPocTickCount,
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
        ], 100)).toBe(3);
        expect(getPocStreamCount([
            { tick_time: 99 },
            { tick_time: 100 },
            { tick_time: 101 },
        ], 100)).toBe(2);
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