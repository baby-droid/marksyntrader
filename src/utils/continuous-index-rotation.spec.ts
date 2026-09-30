import { CONTINUOUS_INDEX_SYMBOLS, getNextContinuousIndex } from './continuous-index-rotation';

describe('Continuous Index rotation', () => {
    it('rotates from Volatility 10 (1s) to the plain Volatility 25 index', () => {
        expect(getNextContinuousIndex('1HZ10V')).toBe('R_25');
    });

    it('advances to the next market in the configured order', () => {
        expect(getNextContinuousIndex('1HZ15V')).toBe('1HZ25V');
        expect(getNextContinuousIndex('R_50')).toBe('1HZ50V');
    });

    it('wraps from the last market back to the first', () => {
        expect(getNextContinuousIndex('1HZ100V')).toBe('R_10');
    });

    it('rejects symbols outside the Continuous Indices rotation list', () => {
        expect(() => getNextContinuousIndex('JD10')).toThrow('unsupported Continuous Index');
    });
});