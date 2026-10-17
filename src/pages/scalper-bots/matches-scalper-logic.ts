export type MatchesScalperRange = '0-5' | '6-9';
export type MatchesScalperEntryMode = 'random' | 'selected';

export type MatchesScalperTarget = {
    digit: number;
    attempts: number;
    count20: number;
    count10: number;
};

export type MatchesScalperEntrySignal = {
    ready: boolean;
    triggerDigit: number | null;
    reason: string;
};

const targetDigits = (range: MatchesScalperRange) =>
    range === '0-5' ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9];

const entryDigits = (range: MatchesScalperRange) =>
    range === '0-5' ? [6, 7, 8, 9] : [0, 1, 2, 3];

const rankByFrequency = (digits: number[], allowed: number[]) =>
    allowed
        .map(digit => ({
            digit,
            count: digits.filter(value => value === digit).length,
            newestIndex: digits.indexOf(digit),
        }))
        .sort((left, right) =>
            right.count - left.count
            || (left.newestIndex < 0 ? Number.MAX_SAFE_INTEGER : left.newestIndex)
                - (right.newestIndex < 0 ? Number.MAX_SAFE_INTEGER : right.newestIndex)
            || left.digit - right.digit,
        );

/**
 * Input is newest-first, matching the scalper terminal's digit window.
 * Top-three agreement between the 20- and 10-tick windows is tried first,
 * then the remaining strongest digits. Tries are capped to four targets.
 */
export const rankMatchesScalperTargets = (
    latestFirst: number[],
    range: MatchesScalperRange,
): MatchesScalperTarget[] => {
    if (latestFirst.length < 20) return [];

    const allowed = targetDigits(range);
    const window20 = latestFirst.slice(0, 20);
    const window10 = latestFirst.slice(0, 10);
    const rank20 = rankByFrequency(window20, allowed);
    const rank10 = rankByFrequency(window10, allowed);
    const top20 = rank20.slice(0, 3);
    const top10 = rank10.slice(0, 3);
    const rank20ByDigit = new Map(rank20.map(item => [item.digit, item]));
    const rank10ByDigit = new Map(rank10.map(item => [item.digit, item]));

    const overlap = top20
        .filter(item => top10.some(recent => recent.digit === item.digit))
        .sort((left, right) => {
            const leftScore = left.count + (rank10ByDigit.get(left.digit)?.count ?? 0);
            const rightScore = right.count + (rank10ByDigit.get(right.digit)?.count ?? 0);
            return rightScore - leftScore || left.newestIndex - right.newestIndex || left.digit - right.digit;
        });
    const ordered: number[] = [];
    const appendUnique = (digit: number) => {
        if (!ordered.includes(digit)) ordered.push(digit);
    };
    overlap.forEach(item => appendUnique(item.digit));
    top10.forEach(item => appendUnique(item.digit));
    top20.forEach(item => appendUnique(item.digit));
    [...rank20]
        .sort((left, right) => {
            const leftScore = left.count + (rank10ByDigit.get(left.digit)?.count ?? 0);
            const rightScore = right.count + (rank10ByDigit.get(right.digit)?.count ?? 0);
            return rightScore - leftScore || left.newestIndex - right.newestIndex || left.digit - right.digit;
        })
        .forEach(item => appendUnique(item.digit));

    return ordered.slice(0, 4).map((digit, index) => ({
        digit,
        attempts: index < 2 ? 3 : 2,
        count20: rank20ByDigit.get(digit)?.count ?? 0,
        count10: rank10ByDigit.get(digit)?.count ?? 0,
    }));
};

export const evaluateMatchesScalperEntry = (
    latestFirst: number[],
    mode: MatchesScalperEntryMode,
    range: MatchesScalperRange,
): MatchesScalperEntrySignal => {
    const recent = latestFirst.slice(0, 5);
    if (recent.length < 5) {
        return { ready: false, triggerDigit: null, reason: `collecting recent entry window (${recent.length}/5)` };
    }

    const triggerRange = entryDigits(range);
    if (mode === 'random') {
        const triggerCount = recent.filter(digit => triggerRange.includes(digit)).length;
        const latest = recent[0];
        const ready = triggerCount >= 2 && triggerRange.includes(latest);
        return {
            ready,
            triggerDigit: ready ? latest : null,
            reason: ready
                ? `5-tick random-entry confirmation (${triggerCount} trigger-range digits)`
                : `5-tick random scan: ${triggerCount}/5 trigger-range digits`,
        };
    }

    const ranked = rankByFrequency(recent, triggerRange);
    const mostActive = ranked[0];
    const ready = mostActive.count > 0 && recent[0] === mostActive.digit;
    return {
        ready,
        triggerDigit: ready ? mostActive.digit : null,
        reason: ready
            ? `selected entry touched: digit ${mostActive.digit} leads the latest 5 ticks`
            : `waiting for most-active selected-entry digit ${mostActive.count ? mostActive.digit : '6–9 / 0–3'} to touch`,
    };
};

