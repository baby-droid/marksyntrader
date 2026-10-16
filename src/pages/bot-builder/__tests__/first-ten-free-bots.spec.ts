import fs from 'node:fs';
import path from 'node:path';

import { config } from '@/external/bot-skeleton/constants/config';
import { CONTINUOUS_INDEX_SYMBOLS } from '@/utils/continuous-index-rotation';
import { tradeTypeForOppositeLookup } from '../bot-builder-trade-compat';

const XML_NAMESPACE = 'https://developers.google.com/blockly/xml';
const FIRST_TEN_BOTS = [
    'ahmed-differ-over-under-cycle-v1.xml',
    'ahmed-differ-recovery-cycle-v2.xml',
    'ahmed-best-market-pair-cycle-v1.xml',
    'ahmed-best-market-pair-cycle-v2.xml',
    'acc-flipper.xml',
    'ahmed-killer-bot-myth-v1.xml',
    'under-cycle-auto.xml',
    'ahmed-over-cycle.xml',
    'differs-edge-scanner.xml',
    'odd-auto-cycle.xml',
];

const getBlocks = (container: Element): Element[] =>
    Array.from(container.getElementsByTagNameNS(XML_NAMESPACE, 'block'));

const getField = (block: Element, name: string): string =>
    Array.from(block.getElementsByTagNameNS(XML_NAMESPACE, 'field'))
        .find(field => field.getAttribute('name') === name)
        ?.textContent?.trim() ?? '';

describe('the first ten Free Bots', () => {
    it.each(FIRST_TEN_BOTS)('%s has valid Blockly structure and trade selectors', filename => {
        const xml = fs.readFileSync(path.resolve(process.cwd(), 'public/bots', filename), 'utf8');
        const document = new DOMParser().parseFromString(xml, 'application/xml');
        const parserErrors = Array.from(document.getElementsByTagName('*'))
            .filter(element => element.localName === 'parsererror');
        expect(parserErrors).toHaveLength(0);
        expect(document.documentElement.localName).toBe('xml');

        const topLevelBlocks = Array.from(document.documentElement.children)
            .filter((element): element is Element => element.localName === 'block');
        const topLevelTypes = topLevelBlocks.map(block => block.getAttribute('type'));
        expect(topLevelTypes).toEqual(expect.arrayContaining([
            'trade_definition',
            'before_purchase',
            'after_purchase',
        ]));

        const blocks = getBlocks(document.documentElement);
        const ids = blocks.map(block => block.getAttribute('id')).filter(Boolean);
        expect(new Set(ids).size).toBe(ids.length);

        const tradeDefinition = topLevelBlocks.find(block => block.getAttribute('type') === 'trade_definition');
        expect(tradeDefinition).toBeDefined();
        const tradeBlocks = getBlocks(tradeDefinition as Element);
        const byType = (type: string) => tradeBlocks.find(block => block.getAttribute('type') === type);

        const market = byType('trade_definition_market');
        const tradeType = byType('trade_definition_tradetype');
        const contractType = byType('trade_definition_contracttype');
        for (const requiredType of [
            'trade_definition_market',
            'trade_definition_tradetype',
            'trade_definition_contracttype',
            'trade_definition_candleinterval',
            'trade_definition_restartonerror',
            'trade_definition_restartbuysell',
        ]) {
            expect(byType(requiredType)).toBeDefined();
        }

        const category = getField(tradeType as Element, 'TRADETYPECAT_LIST');
        const rawTradeType = getField(tradeType as Element, 'TRADETYPE_LIST');
        const lookupKey = tradeTypeForOppositeLookup(category, rawTradeType).toUpperCase();
        expect((config().opposites as Record<string, unknown[]>)[lookupKey]).toBeDefined();
        expect(getField(contractType as Element, 'TYPE_LIST')).toBe('both');

        const marketFields = {
            market: getField(market as Element, 'MARKET_LIST'),
            submarket: getField(market as Element, 'SUBMARKET_LIST'),
            symbol: getField(market as Element, 'SYMBOL_LIST'),
            alternate: getField(market as Element, 'ALTERNATE_MARKETS'),
        };
        if (marketFields.alternate === 'TRUE') {
            expect(marketFields.market).toBe('synthetic_index');
            expect(marketFields.submarket).toBe('random_index');
            expect(CONTINUOUS_INDEX_SYMBOLS).toContain(marketFields.symbol);
        }
    });
});
