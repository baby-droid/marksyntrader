export type PriceDirection = 'rise' | 'fall' | null;

export interface PriceDirectionAnalysis {
    rises: number;
    falls: number;
    flats: number;
    risePercent: number;
    fallPercent: number;
    allRising: boolean;
    allFalling: boolean;
    trailingDirection: PriceDirection;
    trailingStreak: number;
}

/**
 * Analyze quote movement without inferring direction from a market's last
 * digit. Flat ticks are excluded from the rise/fall percentages and break a
 * consecutive-direction streak.
 */
export function analyzePriceDirection(prices: readonly number[]): PriceDirectionAnalysis {
    const quotes = (Array.isArray(prices) ? prices : []).filter(Number.isFinite);
    let rises = 0;
    let falls = 0;
    let flats = 0;

    for (let index = 1; index < quotes.length; index += 1) {
        const delta = quotes[index] - quotes[index - 1];
        if (delta > 0) rises += 1;
        else if (delta < 0) falls += 1;
        else flats += 1;
    }

    const directionalMoves = rises + falls;
    let trailingDirection: PriceDirection = null;
    let trailingStreak = 0;
    for (let index = quotes.length - 1; index > 0; index -= 1) {
        const delta = quotes[index] - quotes[index - 1];
        if (delta === 0) break;
        const direction: PriceDirection = delta > 0 ? 'rise' : 'fall';
        if (trailingDirection && direction !== trailingDirection) break;
        trailingDirection = direction;
        trailingStreak += 1;
    }

    return {
        rises,
        falls,
        flats,
        risePercent: directionalMoves ? rises / directionalMoves * 100 : 50,
        fallPercent: directionalMoves ? falls / directionalMoves * 100 : 50,
        allRising: quotes.length >= 2 && rises === quotes.length - 1,
        allFalling: quotes.length >= 2 && falls === quotes.length - 1,
        trailingDirection,
        trailingStreak,
    };
}
