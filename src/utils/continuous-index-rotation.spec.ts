import { CONTINUOUS_INDEX_SYMBOLS, getNextContinuousIndex } from './continuous-index-rotation';

describe('Continuous Index rotation', () => {
    it('advances to the next market in the configured order', () => {
        expect(getNextContinuousIndex('1HZ15V')).toBe('1HZ25V');
    });

    it('wraps from the last market back to the first', () => {
        expect(getNextContinuousIndex('1HZ100V')).toBe(CONTINUOUS_INDEX_SYMBOLS[0]);
    });

    it('rejects symbols outside the Continuous Indices rotation list', () => {
        expect(() => getNextContinuousIndex('R_50')).toThrow('unsupported Continuous Index');
    });
});