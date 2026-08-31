export type DiffersCycleBotId = 'differs-edge-scanner' | 'ahmed-differs-cycle';
export type CycleSide = 'differs' | 'over' | 'under' | 'even' | 'odd';

export type DiffersCycleStep = {
    label: string;
    side: CycleSide;
    barrier?: number;
};

export type DiffersCycleDefinition = {
    id: DiffersCycleBotId;
    name: string;
    market: string;
    steps: DiffersCycleStep[];
    recovery: string;
};

export type GuidedCycleSettings = {
    stake: number;
    initialStake: number;
    martingale: number;
    ticks: number;
};

export const DIFFERS_SCAN_MARKETS = [
    { label: 'Volatility 10', symbol: 'R_10' },
    { label: 'Volatility 25', symbol: 'R_25' },
    { label: 'Volatility 50', symbol: 'R_50' },
    { label: 'Volatility 75', symbol: 'R_75' },
    { label: 'Volatility 100', symbol: 'R_100' },
    { label: 'Volatility 10 (1s)', symbol: '1HZ10V' },
    { label: 'Volatility 25 (1s)', symbol: '1HZ25V' },
    { label: 'Volatility 50 (1s)', symbol: '1HZ50V' },
    { label: 'Volatility 75 (1s)', symbol: '1HZ75V' },
    { label: 'Volatility 100 (1s)', symbol: '1HZ100V' },
    { label: 'Jump 10', symbol: 'JD10' },
    { label: 'Jump 25', symbol: 'JD25' },
    { label: 'Jump 50', symbol: 'JD50' },
    { label: 'Jump 75', symbol: 'JD75' },
    { label: 'Jump 100', symbol: 'JD100' },
] as const;

export const DIFFERS_CYCLE_DEFINITIONS: Record<DiffersCycleBotId, DiffersCycleDefinition> = {
    'differs-edge-scanner': {
        id: 'differs-edge-scanner',
        name: 'Differs Edge Scanner — Recovery Matrix',
        market: 'V50 1s',
        steps: [
            { label: 'Differs', side: 'differs' },
            { label: 'Over 2', side: 'over', barrier: 2 },
            { label: 'Over 3', side: 'over', barrier: 3 },
            { label: 'Differs', side: 'differs' },
            { label: 'Under 7', side: 'under', barrier: 7 },
            { label: 'Under 6', side: 'under', barrier: 6 },
        ],
        recovery: 'Loss → pattern check → Even/Odd recovery',
    },
    'ahmed-differs-cycle': {
        id: 'ahmed-differs-cycle',
        name: 'AHMED DIFFERS CYCLE',
        market: 'V10 1s',
        steps: [
            { label: 'Differs', side: 'differs' },
            { label: 'Over 1', side: 'over', barrier: 1 },
            { label: 'Over 2', side: 'over', barrier: 2 },
            { label: 'Differs', side: 'differs' },
            { label: 'Under 8', side: 'under', barrier: 8 },
            { label: 'Under 7', side: 'under', barrier: 7 },
        ],
        recovery: 'Loss → pattern check → Even/Odd recovery',
    },
};

export type ScanPoint = { digit: number; quote: number; epoch: number };

export function digitFromQuote(quote: number, pipSize: number): number {
    const fixed = Number(quote).toFixed(Math.max(0, Math.round(pipSize)));
    return Number(fixed.replace('.', '').slice(-1));
}

export function bestDifferDigit(points: ScanPoint[]): number | null {
    const counts = Array.from({ length: 10 }, () => 0);
    points.forEach(point => {
        if (Number.isInteger(point.digit) && point.digit >= 0 && point.digit <= 9) counts[point.digit] += 1;
    });
    if (!points.length) return null;

    // A Differs barrier is strongest when its recent digit is dominant. Ties
    // are resolved by the most recently observed digit.
    const maxCount = Math.max(...counts);
    for (let index = points.length - 1; index >= 0; index -= 1) {
        const digit = points[index].digit;
        if (counts[digit] === maxCount) return digit;
    }
    return 0;
}

export function digitPercentages(points: ScanPoint[]): number[] {
    const counts = Array.from({ length: 10 }, () => 0);
    points.forEach(point => {
        if (Number.isInteger(point.digit) && point.digit >= 0 && point.digit <= 9) counts[point.digit] += 1;
    });
    return counts.map(count => points.length ? (count / points.length) * 100 : 0);
}

export function entryPatternReady(points: ScanPoint[], step: DiffersCycleStep, differDigit: number | null): boolean {
    const digits = points.slice(-4).map(point => point.digit);
    if (step.side === 'differs') {
        return differDigit !== null && digits.length >= 3 && digits[digits.length - 2] === differDigit && digits[digits.length - 1] !== differDigit;
    }
    if ((step.side === 'over' || step.side === 'under') && digits.length === 4 && step.barrier !== undefined) {
        const [first, second, crossing, returning] = digits;
        return step.side === 'over'
            ? first <= step.barrier && second <= step.barrier && crossing > step.barrier && returning <= step.barrier
            : first >= step.barrier && second >= step.barrier && crossing < step.barrier && returning >= step.barrier;
    }
    if (step.side === 'even' || step.side === 'odd') {
        const lastThree = digits.slice(-3);
        return lastThree.length === 3 && lastThree.every(digit => digit % 2 === (step.side === 'even' ? 0 : 1));
    }
    return false;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patchVariableNumber(xml: string, variableName: string, value: number): string {
    const name = escapeRegExp(variableName);
    const pattern = new RegExp(
        `(<block type="variables_set"[^>]*>\\s*<field name="VAR"[^>]*>${name}</field>[\\s\\S]*?<field name="NUM">)[^<]*(</field>)`,
        'g',
    );
    return xml.replace(pattern, `$1${value}$2`);
}

export function patchGuidedCycleXml(
    xml: string,
    symbol: string,
    differDigit: number,
    settings?: GuidedCycleSettings,
): string {
    let guided = xml.replace(
        /(<field name="SYMBOL_LIST">)[^<]*/,
        `$1${symbol}`,
    );

    if (settings) {
        guided = patchVariableNumber(guided, 'stake', settings.stake);
        guided = patchVariableNumber(guided, 'initial_stake', settings.initialStake);
        guided = patchVariableNumber(guided, 'martingale', settings.martingale);
        guided = guided.replace(
            /(<value name="DURATION">[\s\S]*?<field name="NUM">)[^<]*(<\/field>)/,
            `$1${settings.ticks}$2`,
        );
    }

    // Differs uses the AI-selected dominant digit as its barrier when the
    // strategy is loaded. Subsequent cycles can be reloaded with a new scan.
    guided = guided.replace(
        /<block type="multiple_purchase"[^>]*>[\s\S]*?<\/block>/g,
        block => block.includes('<field name="PURCHASE_1">DIGITDIFF</field>')
            ? block.replace(/(<field name="PREDICTION">)[^<]*/, `$1${differDigit}`)
            : block,
    );
    return guided;
}