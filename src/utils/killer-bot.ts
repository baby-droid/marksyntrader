/**
 * Adapts the user's "AHMED SYN ANY MARKET KILLER" strategy template to a
 * concrete signal. Uses variable-name matching to reliably inject stake,
 * martingale, take profit and stop loss into the XML INITIALIZATION block.
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
    barrier?: number;
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
    over:    { cat: 'digits',   tradetype: 'overunder',        type: 'DIGITOVER',  prediction: true  },
    under:   { cat: 'digits',   tradetype: 'overunder',        type: 'DIGITUNDER', prediction: true  },
    even:    { cat: 'digits',   tradetype: 'evenodd',          type: 'DIGITEVEN',  prediction: false },
    odd:     { cat: 'digits',   tradetype: 'evenodd',          type: 'DIGITODD',   prediction: false },
    matches: { cat: 'digits',   tradetype: 'matchesdiffers',   type: 'DIGITMATCH', prediction: true  },
    differs: { cat: 'digits',   tradetype: 'matchesdiffers',   type: 'DIGITDIFF',  prediction: true  },
    rise:    { cat: 'callput',  tradetype: 'callput',          type: 'CALL',       prediction: false },
    fall:    { cat: 'callput',  tradetype: 'callput',          type: 'PUT',        prediction: false },
};

const SYMBOL_SUBMARKET: Record<string, { market: string; submarket: string }> = {
    R_10:      { market: 'synthetic_index', submarket: 'random_index'       },
    R_25:      { market: 'synthetic_index', submarket: 'random_index'       },
    R_50:      { market: 'synthetic_index', submarket: 'random_index'       },
    R_75:      { market: 'synthetic_index', submarket: 'random_index'       },
    R_100:     { market: 'synthetic_index', submarket: 'random_index'       },
    '1HZ10V':  { market: 'synthetic_index', submarket: 'random_index_s1'   },
    '1HZ25V':  { market: 'synthetic_index', submarket: 'random_index_s1'   },
    '1HZ50V':  { market: 'synthetic_index', submarket: 'random_index_s1'   },
    '1HZ75V':  { market: 'synthetic_index', submarket: 'random_index_s1'   },
    '1HZ100V': { market: 'synthetic_index', submarket: 'random_index_s1'   },
    JD10:      { market: 'synthetic_index', submarket: 'jump_index'         },
    JD25:      { market: 'synthetic_index', submarket: 'jump_index'         },
    JD50:      { market: 'synthetic_index', submarket: 'jump_index'         },
    JD75:      { market: 'synthetic_index', submarket: 'jump_index'         },
    JD100:     { market: 'synthetic_index', submarket: 'jump_index'         },
    RDBULL:    { market: 'synthetic_index', submarket: 'daily_reset_index'  },
    RDBEAR:    { market: 'synthetic_index', submarket: 'daily_reset_index'  },
    stpRNG:    { market: 'synthetic_index', submarket: 'step_index'         },
    CRASH300N: { market: 'synthetic_index', submarket: 'crash_index'        },
    CRASH500:  { market: 'synthetic_index', submarket: 'crash_index'        },
    CRASH1000: { market: 'synthetic_index', submarket: 'crash_index'        },
    BOOM300N:  { market: 'synthetic_index', submarket: 'crash_index'        },
    BOOM500:   { market: 'synthetic_index', submarket: 'crash_index'        },
    BOOM1000:  { market: 'synthetic_index', submarket: 'crash_index'        },
};

/**
 * Find every `variables_set` block whose VAR field matches `varName` and
 * update the math_number value in its VALUE child.  Works regardless of
 * nesting depth so it handles both flat and nested INITIALIZATION chains.
 */
function setVarNumValue(doc: Document, varName: string, value: number): void {
    doc.querySelectorAll('block[type="variables_set"]').forEach(block => {
        const varField = block.querySelector('field[name="VAR"]');
        if (!varField || varField.textContent?.trim() !== varName) return;
        const numField = block.querySelector('value[name="VALUE"] block[type="math_number"] field[name="NUM"]');
        if (numField) numField.textContent = String(value);
    });
}

function setField(root: Element | Document, name: string, value: string): void {
    const el = root.querySelector(`field[name="${name}"]`);
    if (el) el.textContent = value;
}

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

    // Market
    setField(doc, 'SYMBOL_LIST', symbol);
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

        const durShadow = tradeOptions.querySelector('value[name="DURATION"] field[name="NUM"]');
        if (durShadow) durShadow.textContent = String(ticks);

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

    // Inject INITIALIZATION values using variable-name matching
    setVarNumValue(doc, 'stake', stake);
    setVarNumValue(doc, 'initial stake ', stake);  // note trailing space in template
    setVarNumValue(doc, 'initial stake', stake);
    setVarNumValue(doc, 'Martingale', martingale);

    if (takeProfit !== undefined) {
        setVarNumValue(doc, 'totalprofit', takeProfit);
    }
    if (stopLoss !== undefined) {
        setVarNumValue(doc, 'totalloss', stopLoss);
    }

    return new XMLSerializer().serializeToString(doc);
}
