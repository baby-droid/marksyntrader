import fs from 'node:fs';
import path from 'node:path';
import type {
    AutoSignalCandidate,
    AutoSignalMarket,
    AutoSignalsSettings,
} from './types';
import {
    AUTO_SIGNAL_BOTS,
    AUTO_SIGNAL_DURATION_TICKS,
    getAutoSignalBot,
    patchAutoSignalsBotXml,
} from './bot-xml';

const XML_NS = 'https://developers.google.com/blockly/xml';
const settings: AutoSignalsSettings = {
    maxRuns: 1,
    stake1: 1.5,
    stake2: 1.5,
    takeProfit: 5,
    stopLoss: 10,
    martingale: 2,
};
const market: AutoSignalMarket = {
    symbol: 'R_10',
    label: 'Volatility 10',
    market: 'synthetic_index',
    submarket: 'random_index',
    tickCount: 100,
    latestDigit: 6,
    latestQuote: 100.26,
    updatedAt: Date.now(),
    feedState: 'live',
    candidate: null,
    availableContractTypes: [],
};

const makeCandidate = (
    contractType: string,
    strategy: AutoSignalCandidate['strategy'],
    barrier: number | null,
    direction: AutoSignalCandidate['direction'],
): AutoSignalCandidate => ({
    id: 'test-signal',
    strategy,
    label: strategy,
    contractType,
    barrier,
    direction,
    score: 80,
    tier: 'STRONG',
    state: 'ready',
    reason: 'test signal',
    windows: [],
    entryDigit: 6,
    entryReady: true,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    updatedAt: Date.now(),
    recommendedRuns: 1,
});

const getBlock = (doc: Document, type: string) =>
    Array.from(doc.getElementsByTagNameNS(XML_NS, 'block'))
        .find((block) => block.getAttribute('type') === type);

const getField = (block: Element | undefined, name: string) =>
    block && Array.from(block.getElementsByTagNameNS(XML_NS, 'field'))
        .find((field) => field.getAttribute('name') === name)?.textContent;

const getValueNumber = (block: Element | undefined, inputName: string) => {
    const value = block && Array.from(block.getElementsByTagNameNS(XML_NS, 'value'))
        .find((item) => item.getAttribute('name') === inputName);
    return value && Array.from(value.getElementsByTagNameNS(XML_NS, 'field'))
        .find((field) => field.getAttribute('name') === 'NUM')?.textContent;
};

const getVariableSetNumber = (doc: Document, variableName: string) => {
    const setter = Array.from(doc.getElementsByTagNameNS(XML_NS, 'block'))
        .find((block) =>
            block.getAttribute('type') === 'variables_set'
            && getField(block, 'VAR') === variableName
        );
    return getValueNumber(setter, 'VALUE');
};

const readTemplate = (
    action: keyof typeof AUTO_SIGNAL_BOTS,
    candidate: AutoSignalCandidate = makeCandidate('DIGITEVEN', 'EVEN', null, 'even'),
) => {
    const bot = getAutoSignalBot(action, candidate);
    return fs.readFileSync(path.resolve(process.cwd(), 'public', bot.file.replace(/^\//, '')), 'utf8');
};

describe('Auto-Signals bot templates', () => {
    it.each([
        ['trade-only', 'DIGITOVER', 'OVER', 4, 'digits', 'overunder', 'DIGITOVER'],
        ['trade-only', 'DIGITMATCH', 'MATCHES', 3, 'digits', 'matchesdiffers', 'DIGITMATCH'],
        ['trade-only', 'DIGITDIFF', 'DIFFERS', 3, 'digits', 'matchesdiffers', 'DIGITDIFF'],
        ['entry-trade', 'DIGITUNDER', 'UNDER', 5, 'digits', 'overunder', 'DIGITUNDER'],
        ['entry-trade', 'DIGITMATCH', 'MATCHES', 3, 'digits', 'matchesdiffers', 'DIGITMATCH'],
        ['entry-trade', 'DIGITDIFF', 'DIFFERS', 3, 'digits', 'matchesdiffers', 'DIGITDIFF'],
        ['entry-trade', 'DIGITEVEN', 'EVEN', null, 'digits', 'evenodd', 'DIGITEVEN'],
        ['entry-trade', 'DIGITODD', 'ODD', null, 'digits', 'evenodd', 'DIGITODD'],
        ['entry-trade', 'CALL', 'RISE', null, 'callput', 'risefall', 'CALL'],
        ['entry-trade', 'PUT', 'FALL', null, 'callput', 'risefall', 'PUT'],
        ['entry-trade', 'RUNHIGH', 'ONLY_UPS', null, 'digits', 'runs', 'RUNHIGH'],
        ['entry-trade', 'RUNLOW', 'ONLY_DOWNS', null, 'digits', 'runs', 'RUNLOW'],
    ] as const)(
        'patches %s for %s to the selected one-tick contract',
        (action, contractType, strategy, barrier, category, tradeType, purchaseType) => {
            const candidate = makeCandidate(
                contractType,
                strategy,
                barrier,
                strategy === 'RISE' ? 'rise'
                    : strategy === 'FALL' ? 'fall'
                        : strategy === 'ONLY_UPS' ? 'up'
                            : strategy === 'ONLY_DOWNS' ? 'down' : 'even',
            );
            const xml = patchAutoSignalsBotXml(readTemplate(action, candidate), {
                action,
                market,
                candidate,
                settings,
                accountAmounts: { stake1: 1.5, stake2: 1.5, takeProfit: 5, stopLoss: 10 },
            });
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            const tradeOptions = getBlock(doc, 'trade_definition_tradeoptions');
            const isEntryTrade = action === 'entry-trade';

            expect(getField(tradeOptions, 'DURATIONTYPE_LIST')).toBe('t');
            expect(getValueNumber(tradeOptions, 'DURATION')).toBe(String(AUTO_SIGNAL_DURATION_TICKS));
            expect(getField(getBlock(doc, 'trade_definition_tradetype'), 'TRADETYPECAT_LIST')).toBe(category);
            expect(getField(getBlock(doc, 'trade_definition_tradetype'), 'TRADETYPE_LIST')).toBe(tradeType);
            expect(getField(getBlock(doc, 'trade_definition_contracttype'), 'TYPE_LIST')).toBe(contractType);
            expect(getField(getBlock(doc, 'purchase'), 'PURCHASE_LIST')).toBe(purchaseType);
            const usesNormalKillerV3 = action === 'trade-only'
                && (strategy === 'MATCHES' || strategy === 'DIFFERS');
            if (usesNormalKillerV3) {
                expect(getField(tradeOptions, 'VAR')).toBe('stake');
            } else {
                expect(getValueNumber(tradeOptions, 'AMOUNT')).toBe('1.5');
            }
            expect(getVariableSetNumber(doc, isEntryTrade ? 'STAKE' : 'stake')).toBe('1.5');
            expect(getVariableSetNumber(
                doc,
                isEntryTrade ? 'martingalelevel' : usesNormalKillerV3 ? 'martingale' : 'Martingale',
            )).toBe('2');
            if (isEntryTrade) {
                expect(getVariableSetNumber(doc, 'stake2')).toBe('1.5');
                expect(getField(getBlock(doc, 'auto_signal_entry_gate'), 'STRATEGY')).toBe(strategy);
                expect(getField(getBlock(doc, 'auto_signal_entry_gate'), 'ENTRY_DIGIT')).toBe('6');
            }
            if (barrier !== null) expect(getValueNumber(tradeOptions, 'PREDICTION')).toBe(String(barrier));
            if (
                action === 'trade-only'
                && (strategy === 'MATCHES' || strategy === 'DIFFERS')
            ) {
                expect(getBlock(doc, 'normal_killer_tick_acceleration')).toBeDefined();
                expect(getVariableSetNumber(doc, 'base_stake')).toBe('1.5');
                expect(getVariableSetNumber(doc, 'take_profit')).toBe('5');
                expect(getVariableSetNumber(doc, 'stop_loss')).toBe('10');
                expect(getBlock(doc, 'after_purchase')?.getElementsByTagNameNS(XML_NS, 'data')[0]?.textContent)
                    .toBe('auto-signal-v1;stop-after-win=1;max-runs=1');
            }
        },
    );

    it.each([
        ['MATCHES', 'DIGITMATCH'],
        ['DIFFERS', 'DIGITDIFF'],
    ] as const)('routes Trade Only %s through Normal Killer Bot V3', (strategy, contractType) => {
        const bot = getAutoSignalBot('trade-only', makeCandidate(contractType, strategy, 6, strategy.toLowerCase() as AutoSignalCandidate['direction']));
        expect(bot.name).toBe('Normal Killer Bot V3');
        expect(bot.file).toBe('/bots/normal-killer-bot-v3.xml');
    });

    it('sets both Entry Trade stakes to 1.5 with a 2x martingale', () => {
        const xml = patchAutoSignalsBotXml(readTemplate('entry-trade'), {
            action: 'entry-trade',
            market,
            candidate: makeCandidate('DIGITEVEN', 'EVEN', null, 'even'),
            settings: { ...settings, martingale: 2 },
            accountAmounts: { stake1: 1.5, stake2: 1.5, takeProfit: 5, stopLoss: 10 },
        });
        const doc = new DOMParser().parseFromString(xml, 'application/xml');

        expect(getValueNumber(getBlock(doc, 'trade_definition_tradeoptions'), 'AMOUNT')).toBe('1.5');
        expect(getVariableSetNumber(doc, 'STAKE')).toBe('1.5');
        expect(getVariableSetNumber(doc, 'stake2')).toBe('1.5');
        expect(getVariableSetNumber(doc, 'martingalelevel')).toBe('2');
    });

    it('adds the two-loss Over 4 to Under 5 recovery to Entry Trade only', () => {
        const xml = patchAutoSignalsBotXml(readTemplate('entry-trade'), {
            action: 'entry-trade',
            market,
            candidate: makeCandidate('DIGITOVER', 'OVER', 4, 'over'),
            settings: { ...settings, maxRuns: 4 },
            accountAmounts: { stake1: 1.5, stake2: 1.5, takeProfit: 5, stopLoss: 10 },
        });
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const variableNames = Array.from(doc.getElementsByTagNameNS(XML_NS, 'variable'))
            .map((variable) => variable.textContent);
        const purchases = Array.from(doc.getElementsByTagNameNS(XML_NS, 'block'))
            .filter((block) => block.getAttribute('type') === 'purchase')
            .map((block) => getField(block, 'PURCHASE_LIST'));

        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(variableNames).toEqual(expect.arrayContaining([
            'AUTO_SIGNAL_OVER4_RECOVERY',
            'AUTO_SIGNAL_OVER4_LOSSES',
        ]));
        expect(purchases).toEqual(expect.arrayContaining(['DIGITOVER', 'DIGITUNDER']));
        expect(getField(getBlock(doc, 'trade_definition_contracttype'), 'TYPE_LIST')).toBe('DIGITOVER');
        expect(getField(getBlock(doc, 'trade_definition_tradetype'), 'TRADETYPE_LIST')).toBe('overunder');
    });

    it('caps the loaded bot at the signal-selected suggested run count', () => {
        const xml = patchAutoSignalsBotXml(readTemplate('entry-trade'), {
            action: 'entry-trade',
            market,
            candidate: makeCandidate('DIGITOVER', 'OVER', 4, 'over'),
            settings: { ...settings, maxRuns: 4 },
            accountAmounts: { stake1: 1.5, stake2: 1.5, takeProfit: 5, stopLoss: 10 },
        });
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const tradeAgain = getBlock(doc, 'trade_again');
        const runLimit = tradeAgain?.parentElement?.parentElement;

        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(runLimit?.getAttribute('type')).toBe('controls_if');
        expect(getValueNumber(runLimit, 'B')).toBe('4');
    });

    it('keeps Over DT at Over 1 and preserves the Under 5 recovery purchase', () => {
        const xml = patchAutoSignalsBotXml(readTemplate('over-dt'), {
            action: 'over-dt',
            market,
            candidate: makeCandidate('DIGITOVER', 'OVER', 4, 'over'),
            settings,
            accountAmounts: { stake1: 1.5, stake2: 1.5, takeProfit: 5, stopLoss: 10 },
        });
        const doc = new DOMParser().parseFromString(xml, 'application/xml');

        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(getField(getBlock(doc, 'trade_definition_contracttype'), 'TYPE_LIST')).toBe('both');
        expect(getValueNumber(getBlock(doc, 'trade_definition_tradeoptions'), 'DURATION')).toBe('1');
        expect(getVariableSetNumber(doc, 'PREDICTION-1')).toBe('1');
        expect(getVariableSetNumber(doc, 'PREDICTION-2')).toBe('5');
        expect(Array.from(doc.getElementsByTagNameNS(XML_NS, 'block'))
            .filter((block) => block.getAttribute('type') === 'purchase')
            .map((block) => getField(block, 'PURCHASE_LIST')))
            .toEqual(['DIGITOVER', 'DIGITUNDER']);
        expect(getVariableSetNumber(doc, 'stake')).toBe('1.5');
        expect(getVariableSetNumber(doc, 'Martingale')).toBe('2');
    });

    it('keeps Under DT recovery at Under 5 when the main barrier is selected', () => {
        const xml = patchAutoSignalsBotXml(readTemplate('under-dt'), {
            action: 'under-dt',
            market,
            candidate: makeCandidate('DIGITUNDER', 'UNDER', 7, 'under'),
            settings,
            accountAmounts: { stake1: 1.5, stake2: 1.5, takeProfit: 5, stopLoss: 10 },
        });
        const doc = new DOMParser().parseFromString(xml, 'application/xml');

        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(getField(getBlock(doc, 'trade_definition_contracttype'), 'TYPE_LIST')).toBe('both');
        expect(getVariableSetNumber(doc, 'PREDICTION-1')).toBe('7');
        expect(getVariableSetNumber(doc, 'PREDICTION-2')).toBe('5');
        expect(Array.from(doc.getElementsByTagNameNS(XML_NS, 'block'))
            .filter((block) => block.getAttribute('type') === 'purchase')
            .map((block) => getField(block, 'PURCHASE_LIST')))
            .toEqual(['DIGITUNDER', 'DIGITUNDER']);
        expect(getVariableSetNumber(doc, 'stake')).toBe('1.5');
        expect(getVariableSetNumber(doc, 'Martingale')).toBe('2');
    });
});
