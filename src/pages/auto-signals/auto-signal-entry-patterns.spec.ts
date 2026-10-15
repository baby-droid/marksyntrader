import { hasAutoSignalPriceEntryPattern } from './auto-signals-engine';

const ticksForMoves = (moves: number[]) => {
    let quote = 100;
    return [
        { symbol: 'R_50', epoch: 1, quote, digit: 0, pip_size: 2 },
        ...moves.map((move, index) => {
            quote += move;
            return {
                symbol: 'R_50',
                epoch: index + 2,
                quote,
                digit: 0,
                pip_size: 2,
            };
        }),
    ];
};

describe('Auto-Signals rise/fall entry patterns', () => {
    it.each([
        [[1, 1, 1, -1]],
        [[1, 1, 1, 1, -1]],
        [[1, 1, 1, 1, 1]],
    ])('accepts the requested Fall sequence %j', (moves) => {
        expect(hasAutoSignalPriceEntryPattern('FALL', ticksForMoves(moves))).toBe(true);
    });

    it.each([
        [[-1, -1]],
        [[-1, -1, 1]],
        [[-1, -1, -1]],
    ])('accepts the requested Rise sequence %j', (moves) => {
        expect(hasAutoSignalPriceEntryPattern('RISE', ticksForMoves(moves))).toBe(true);
    });

    it('does not treat longer or incomplete runs as one of the exact entry sequences', () => {
        expect(hasAutoSignalPriceEntryPattern('FALL', ticksForMoves([1, 1, -1]))).toBe(false);
        expect(hasAutoSignalPriceEntryPattern('FALL', ticksForMoves([1, 1, 1, 1, 1, -1]))).toBe(false);
        expect(hasAutoSignalPriceEntryPattern('RISE', ticksForMoves([-1, -1, -1, -1]))).toBe(false);
        expect(hasAutoSignalPriceEntryPattern('RISE', ticksForMoves([-1, -1, -1, 1]))).toBe(false);
    });
});
