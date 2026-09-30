export const CONTINUOUS_INDEX_SYMBOLS = Object.freeze([
    'R_10',
    '1HZ10V',
    'R_25',
    '1HZ15V',
    '1HZ25V',
    '1HZ30V',
    'R_50',
    '1HZ50V',
    'R_75',
    '1HZ75V',
    '1HZ90V',
    'R_100',
    '1HZ100V',
] as const);

export function getNextContinuousIndex(
    currentSymbol: string,
    symbols: readonly string[] = CONTINUOUS_INDEX_SYMBOLS,
): string {
    if (symbols.length < 2) {
        throw new Error('Continuous Index rotation requires at least two markets.');
    }

    const currentIndex = symbols.indexOf(currentSymbol);
    if (currentIndex < 0) {
        throw new Error(`Cannot rotate from unsupported Continuous Index: ${currentSymbol}`);
    }

    return symbols[(currentIndex + 1) % symbols.length];
}