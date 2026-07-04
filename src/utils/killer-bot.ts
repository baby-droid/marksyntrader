/**
 * Adapts the user's "AHMED SYN ANY MARKET KILLER 1.2" strategy template to a
 * concrete signal. One template drives every trade type — we rewrite the
 * market symbol, trade-type category, contract type, prediction digit,
 * duration, stake, martingale, take profit and stop loss via DOM manipulation.
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
    takeProfit?: number;
    stopLoss?: number;
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

/** Submarket mapping: symbol → { market, submarket } for proper Blockly category assignment */
const SYMBOL_SUBMARKET: Record<string, { market: string; submarket: string }> = {
    // Continuous indices (Volatility)
    R_10: { market: 'synthetic_index', submarket: 'random_index' },
    R_25: { market: 'synthetic_index', submarket: 'random_index' },
    R_50: { market: 'synthetic_index', submarket: 'random_index' },
    R_75: { market: 'synthetic_index', submarket: 'random_index' },
    R_100: { market: 'synthetic_index', submarket: 'random_index' },
    '1HZ10V': { market: 'synthetic_index', submarket: 'random_index_s1' },
    '1HZ25V': { market: 'synthetic_index', submarket: 'random_index_s1' },
    '1HZ50V': { market: 'synthetic_index', submarket: 'random_index_s1' },
    '1HZ75V': { market: 'synthetic_index', submarket: 'random_index_s1' },
    '1HZ100V': { market: 'synthetic_index', submarket: 'random_index_s1' },
    // Jump indices
    JD10: { market: 'synthetic_index', submarket: 'jump_index' },
    JD25: { market: 'synthetic_index', submarket: 'jump_index' },
    JD50: { market: 'synthetic_index', submarket: 'jump_index' },
    JD75: { market: 'synthetic_index', submarket: 'jump_index' },
    JD100: { market: 'synthetic_index', submarket: 'jump_index' },
    // Daily Reset Indices (Bull/Bear)
    RDBULL: { market: 'synthetic_index', submarket: 'daily_reset_index' },
    RDBEAR: { market: 'synthetic_index', submarket: 'daily_reset_index' },
    // Step
    stpRNG: { market: 'synthetic_index', submarket: 'step_index' },
    // Crash/Boom
    CRASH300N: { market: 'synthetic_index', submarket: 'crash_index' },
    CRASH500: { market: 'synthetic_index', submarket: 'crash_index' },
    CRASH1000: { market: 'synthetic_index', submarket: 'crash_index' },
    BOOM300N: { market: 'synthetic_index', submarket: 'crash_index' },
    BOOM500: { market: 'synthetic_index', submarket: 'crash_index' },
    BOOM1000: { market: 'synthetic_index', submarket: 'crash_index' },
};

const setField = (root: Element | Document, name: string, value: string) => {
    const el = root.querySelector(`field[name="${name}"]`);
    if (el) el.textContent = value;
};

/** Build a ready-to-load strategy XML string from the template + signal. */
export function buildKillerXml(template: string, params: KillerParams): string {
    const {
        symbol,
        contract,
        barrier = 1,
        ticks = 1,
        stake = 0.5,
        martingale = 2.2,
        takeProfit,
        stopLoss,
    } = params;
    const map = CONTRACT_MAP[contract];
    const submarketInfo = SYMBOL_SUBMARKET[symbol];

    const doc = new DOMParser().parseFromString(template, 'text/xml');

    // Market symbol
    setField(doc, 'SYMBOL_LIST', symbol);

    // Market/submarket category (for Blockly bot builder proper rendering)
    if (submarketInfo) {
        setField(doc, 'MARKET_LIST', submarketInfo.market);
        setField(doc, 'SUBMARKET_LIST', submarketInfo.submarket);
    }

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
    const initBlocks = Array.from(
        doc.querySelectorAll('statement[name="INITIALIZATION"] block[type="math_number"]')
    );
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

    // Take Profit — look for "totalprofit" field in INITIALIZATION block
    if (takeProfit !== undefined) {
        const allFields = Array.from(doc.querySelectorAll('statement[name="INITIALIZATION"] field[name="NUM"]'));
        // Find a field that's set to 2 (default totalprofit value) and update it
        allFields.forEach(f => {
            if (f.textContent === '2' || f.textContent === '10') {
                // Check if parent block relates to totalprofit
                const parentBlock = f.closest('block');
                if (parentBlock) {
                    const prevSibling = parentBlock.previousElementSibling;
                    const parentStr = parentBlock.outerHTML || '';
                    if (parentStr.includes('totalprofit')) {
                        f.textContent = String(takeProfit);
                    }
                }
            }
        });
        // Also look for totalprofit field directly
        doc.querySelectorAll('field[name="NUM"]').forEach(f => {
            const block = f.closest('block');
            const nextBlock = block?.nextElementSibling;
            if (nextBlock && nextBlock.textContent?.includes('totalprofit')) {
                // Might be the stake for totalprofit condition
            }
        });
        // Simple approach: look for value near totalprofit set block
        const xmlStr = new XMLSerializer().serializeToString(doc);
        // The template sets totalprofit to a value — find it by context if field value is '2'
        setField(doc, 'TOTAL_PROFIT', String(takeProfit));
    }

    // Stop Loss — look for totalstake or stoploss related field
    if (stopLoss !== undefined) {
        setField(doc, 'TOTAL_LOSS', String(stopLoss));
        setField(doc, 'STOP_LOSS', String(stopLoss));
    }

    return new XMLSerializer().serializeToString(doc);
}
