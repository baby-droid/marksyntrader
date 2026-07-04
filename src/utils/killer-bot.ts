/**
 * Adapts the user's "AHMED SYN ANY MARKET KILLER 1.2" strategy template to a
 * concrete signal. One template drives every trade type — we rewrite the
 * market symbol, trade-type category, contract type, prediction digit,
 * duration, stake and martingale via DOM manipulation (robust vs. regex).
 */

export type KillerContract =
    | 'over'
    | 'under'
    | 'even'
    | 'odd'
    | 'matches'
    | 'differs'
    | 'rise'
    | 'fall';

interface KillerParams {
    symbol: string;
    contract: KillerContract;
    barrier?: number; // prediction digit for over/under/matches/differs
    ticks?: number;
    stake?: number;
    martingale?: number;
}

const CONTRACT_MAP: Record<
    KillerContract,
    { cat: string; tradetype: string; type: string; prediction: boolean }
> = {
    over: { cat: 'digits', tradetype: 'overunder', type: 'DIGITOVER', prediction: true },
    under: { cat: 'digits', tradetype: 'overunder', type: 'DIGITUNDER', prediction: true },
    even: { cat: 'digits', tradetype: 'evenodd', type: 'DIGITEVEN', prediction: false },
    odd: { cat: 'digits', tradetype: 'evenodd', type: 'DIGITODD', prediction: false },
    matches: { cat: 'digits', tradetype: 'matchesdiffers', type: 'DIGITMATCH', prediction: true },
    differs: { cat: 'digits', tradetype: 'matchesdiffers', type: 'DIGITDIFF', prediction: true },
    rise: { cat: 'callput', tradetype: 'callput', type: 'CALL', prediction: false },
    fall: { cat: 'callput', tradetype: 'callput', type: 'PUT', prediction: false },
};

const setField = (root: Element | Document, name: string, value: string) => {
    const el = root.querySelector(`field[name="${name}"]`);
    if (el) el.textContent = value;
};

/** Build a ready-to-load strategy XML string from the template + signal. */
export function buildKillerXml(template: string, params: KillerParams): string {
    const { symbol, contract, barrier = 1, ticks = 1, stake = 0.5, martingale = 2.2 } = params;
    const map = CONTRACT_MAP[contract];

    const doc = new DOMParser().parseFromString(template, 'text/xml');

    // Market
    setField(doc, 'SYMBOL_LIST', symbol);

    // Trade type / contract type
    setField(doc, 'TRADETYPECAT_LIST', map.cat);
    setField(doc, 'TRADETYPE_LIST', map.tradetype);
    setField(doc, 'TYPE_LIST', map.type);
    setField(doc, 'PURCHASE_LIST', map.type);

    // Trade options block (duration + prediction)
    const tradeOptions = doc.querySelector('block[type="trade_definition_tradeoptions"]');
    if (tradeOptions) {
        const mutation = tradeOptions.querySelector('mutation');
        if (mutation) mutation.setAttribute('has_prediction', map.prediction ? 'true' : 'false');

        // Duration (ticks)
        const durShadow = tradeOptions.querySelector('value[name="DURATION"] field[name="NUM"]');
        if (durShadow) durShadow.textContent = String(ticks);

        // Prediction
        const predValue = tradeOptions.querySelector('value[name="PREDICTION"]');
        if (map.prediction) {
            if (predValue) {
                const predField = predValue.querySelector('field[name="NUM"]');
                if (predField) predField.textContent = String(barrier);
            }
        } else if (predValue) {
            predValue.remove();
        }
    }

    // Stake + initial stake — the first two INITIALIZATION math_number blocks hold 0.5.
    const initBlocks = Array.from(doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="math_number"]'));
    let stakeSet = 0;
    initBlocks.forEach(b => {
        const f = b.querySelector('field[name="NUM"]');
        if (f && f.textContent === '0.5' && stakeSet < 2) {
            f.textContent = String(stake);
            stakeSet += 1;
        }
    });

    // Martingale multiplier (2.2 in the template).
    doc.querySelectorAll('field[name="NUM"]').forEach(f => {
        if (f.textContent === '2.2') f.textContent = String(martingale);
    });

    return new XMLSerializer().serializeToString(doc);
}
