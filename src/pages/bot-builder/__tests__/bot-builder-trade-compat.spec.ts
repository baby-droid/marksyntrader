import {
    installBotBuilderTradeTypeCompatibility,
    tradeTypeForOppositeLookup,
} from '../bot-builder-trade-compat';

const opposites: Record<string, Array<Record<string, string>>> = {
    CALLPUT: [{ CALL: 'Rise' }, { PUT: 'Fall' }],
    OVERUNDER: [{ DIGITOVER: 'Over' }, { DIGITUNDER: 'Under' }],
};

const makeGenerator = () => ({
    forBlock: {
        trade_definition: (block: any) => {
            const tradeTypeBlock = block.getChildByType('trade_definition_tradetype');
            const key = String(tradeTypeBlock.getFieldValue('TRADETYPE_LIST')).toUpperCase();
            return opposites[key].flatMap(entry => Object.keys(entry));
        },
    },
});

const makeTradeDefinitionBlock = (category: string, tradeType: string) => {
    const tradeTypeBlock = {
        getFieldValue: (fieldName: string) => ({
            TRADETYPECAT_LIST: category,
            TRADETYPE_LIST: tradeType,
        }[fieldName]),
    };

    return {
        tradeTypeBlock,
        block: {
            getChildByType: (type: string) =>
                type === 'trade_definition_tradetype' ? tradeTypeBlock : undefined,
        },
    };
};

describe('Bot Builder Rise/Fall generator compatibility', () => {
    it('maps Rise/Fall to the CALLPUT contract group without changing the workspace field', () => {
        const generator = makeGenerator();
        const blockly = { JavaScript: { javascriptGenerator: generator } };
        const { block, tradeTypeBlock } = makeTradeDefinitionBlock('callput', 'risefall');

        expect(() => generator.forBlock.trade_definition(block)).toThrow();
        expect(installBotBuilderTradeTypeCompatibility(blockly)).toBe(true);
        expect(generator.forBlock.trade_definition(block)).toEqual(['CALL', 'PUT']);
        expect(tradeTypeBlock.getFieldValue('TRADETYPE_LIST')).toBe('risefall');

        expect(installBotBuilderTradeTypeCompatibility(blockly)).toBe(true);
        expect(generator.forBlock.trade_definition(block)).toEqual(['CALL', 'PUT']);
    });

    it('leaves valid digit trade-type keys unchanged', () => {
        expect(tradeTypeForOppositeLookup('digits', 'overunder')).toBe('overunder');

        const generator = makeGenerator();
        const blockly = { JavaScript: { javascriptGenerator: generator } };
        const { block } = makeTradeDefinitionBlock('digits', 'overunder');

        expect(installBotBuilderTradeTypeCompatibility(blockly)).toBe(true);
        expect(generator.forBlock.trade_definition(block)).toEqual(['DIGITOVER', 'DIGITUNDER']);
    });
});
