export type MatchesScalperXmlAttemptResult<T> =
    | { ok: true; value: T }
    | { ok: false; reason: string };

export const patchMatchesScalperXmlPrediction = (xml: string, digit: number): string => {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        throw new Error(`Invalid DIGITMATCH barrier: ${digit}`);
    }

    const predictionField = /(<value name="PREDICTION">[\s\S]*?<field name="NUM">)\s*-?\d+(\s*<\/field>)/;
    if (!predictionField.test(xml)) {
        throw new Error('The XML bot has no DIGITMATCH prediction field.');
    }
    return xml.replace(predictionField, `$1${digit}$2`);
};

export const readMatchesScalperXmlPrediction = (xml: string): number | null => {
    const match = xml.match(/<value name="PREDICTION">[\s\S]*?<field name="NUM">\s*(-?\d+)\s*<\/field>/);
    if (!match) return null;
    const digit = Number(match[1]);
    return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null;
};

/** Loads the exact barrier into Blockly before allowing the Bot Builder Run action. */
export const runMatchesScalperTradeAttempt = async <T>(
    digit: number,
    loadTargetXml: (target: number) => Promise<boolean>,
    executeTrade: () => Promise<T>,
): Promise<MatchesScalperXmlAttemptResult<T>> => {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        return { ok: false, reason: `Invalid DIGITMATCH barrier ${digit}.` };
    }

    try {
        const loaded = await loadTargetXml(digit);
        if (!loaded) return { ok: false, reason: `Blockly did not load barrier ${digit}.` };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error || 'Unknown XML load error');
        return { ok: false, reason };
    }

    return { ok: true, value: await executeTrade() };
};
