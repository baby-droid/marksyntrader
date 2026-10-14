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
});
