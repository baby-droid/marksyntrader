export type TwoPredictionStakeBinding = {
    current: string;
    base: string;
};

/**
 * Generate interpreter-safe code that adjusts the four editable stake legs
 * from the net result of the paired contracts.
 */
export const buildTwoPredictionPairMartingaleCode = (
    bindings: TwoPredictionStakeBinding[],
    multiplierVariable: string,
): string => {
    if (!bindings.length || !multiplierVariable) return '';

    const resetStakes = bindings
        .map(binding => `${binding.current} = ${binding.base};`)
        .join('\n');
    const increaseStakes = bindings
        .map(binding => `${binding.current} = ${binding.current} * twoPredictionMartingaleFactor;`)
        .join('\n');

    return `
        var twoPredictionPairResult = Bot.isKingFisherPairWin();
        if (twoPredictionPairResult === true) {
            ${resetStakes}
        } else if (twoPredictionPairResult === false) {
            var twoPredictionMartingaleFactor = ${multiplierVariable};
            if (!(twoPredictionMartingaleFactor >= 1)) twoPredictionMartingaleFactor = 1;
            ${increaseStakes}
        }`;
};
