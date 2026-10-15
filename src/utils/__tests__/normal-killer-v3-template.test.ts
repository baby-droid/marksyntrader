import fs from 'node:fs';
import path from 'node:path';

const XML_NS = 'https://developers.google.com/blockly/xml';
const getBlock = (doc: Document, type: string, id?: string) =>
    Array.from(doc.getElementsByTagNameNS(XML_NS, 'block'))
        .find((block) => block.getAttribute('type') === type && (!id || block.getAttribute('id') === id));
const getField = (block: Element | undefined, name: string) =>
    block && Array.from(block.getElementsByTagNameNS(XML_NS, 'field'))
        .find((field) => field.getAttribute('name') === name)?.textContent;

describe('Normal Killer Bot V3 template', () => {
    const xml = fs.readFileSync(
        path.resolve(process.cwd(), 'public/bots/normal-killer-bot-v3.xml'),
        'utf8',
    );
    const doc = new DOMParser().parseFromString(xml, 'application/xml');

    it('uses tick acceleration without any Virtual Hook settings', () => {
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        const blocks = Array.from(doc.getElementsByTagNameNS(XML_NS, 'block'));
        expect(blocks.filter((block) =>
            block.getAttribute('type') === 'king_fisher_virtual_hook'
        )).toHaveLength(0);
        const accelerators = blocks.filter(
            (block) => block.getAttribute('type') === 'normal_killer_tick_acceleration',
        );
        expect(accelerators).toHaveLength(2);
        expect(accelerators.map((block) => block.getAttribute('id')))
            .toEqual(expect.arrayContaining([
                'nkv3_tick_acceleration_main',
                'nkv3_tick_acceleration_during',
            ]));
    });

    it('multiplies the current stake by the bot martingale variable after a loss', () => {
        const multiplier = getBlock(doc, 'math_arithmetic', 'nkv3_stake_product');
        const operands = Array.from(multiplier?.getElementsByTagNameNS(XML_NS, 'block') ?? [])
            .filter((block) => block.getAttribute('type') === 'variables_get')
            .map((block) => getField(block, 'VAR'));

        expect(getField(multiplier, 'OP')).toBe('MULTIPLY');
        expect(operands).toEqual(expect.arrayContaining(['stake', 'martingale']));
        expect(getBlock(doc, 'trade_again', 'nkv3_trade_again')).toBeDefined();
    });

    it('creates missing pipeline variables and keeps the Normal Killer generator runnable', () => {
        const source = fs.readFileSync(
            path.resolve(
                process.cwd(),
                'src/external/bot-skeleton/scratch/blocks/Binary/Tools/KingFisher/index.js',
            ),
            'utf8',
        );
        const startMarker =
            'window.Blockly.JavaScript.javascriptGenerator.forBlock.normal_killer_tick_acceleration = block => {';
        const start = source.indexOf(startMarker);
        const end = source.indexOf('\n};', start);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);

        const generatorSource = source.slice(start, end + 3);
        const variables: Array<{ name: string; getId: () => string }> = [];
        const variableMap = {
            getVariables: () => variables,
            createVariable: (name: string) => {
                const id = `nkv3_${variables.length}`;
                const variable = { name, getId: () => id };
                variables.push(variable);
                return variable;
            },
        };
        const mockWindow = {
            Blockly: {
                derivWorkspace: null,
                Variables: { CATEGORY_NAME: 'VARIABLE' },
                JavaScript: {
                    variableDB_: { getName: (id: string) => `v_${id}` },
                    javascriptGenerator: { forBlock: {} as Record<string, unknown> },
                },
            },
        };
        const createGenerator = new Function(
            'window',
            `${generatorSource}\nreturn window.Blockly.JavaScript.javascriptGenerator.forBlock.normal_killer_tick_acceleration;`,
        ) as (windowObject: typeof mockWindow) => (block: any) => string;
        const generator = createGenerator(mockWindow);
        const workspace = {
            getAllBlocks: () => [{
                type: 'purchase',
                getFieldValue: () => 'DIGITOVER',
            }],
            getVariableMap: () => variableMap,
        };
        const block = {
            data: 'nkv3-tick-acceleration',
            workspace,
            getParent: () => ({ type: 'before_purchase' }),
        };

        const generatedCode = generator(block);

        expect(variables.map(variable => variable.name)).toEqual([
            'stake',
            'base_stake',
            'martingale',
            'take_profit',
            'stop_loss',
        ]);
        expect(generatedCode).toContain('Bot.configureNormalKillerPipeline');
        expect(generatedCode).toContain(': 0.35;');
        expect(generatedCode).toContain('= 2;');
        expect(generatedCode).toContain('= 5;');
        expect(generatedCode).toContain('= 15;');
    });
});
