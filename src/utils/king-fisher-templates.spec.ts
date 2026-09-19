import fs from 'fs';
import path from 'path';

const templates = [
    { file: 'king-fisher-over-2.xml', contract: 'DIGITOVER', barrier: '2', threshold: '3' },
    { file: 'king-fisher-over-3.xml', contract: 'DIGITOVER', barrier: '3', threshold: '4' },
    { file: 'king-fisher-under-6.xml', contract: 'DIGITUNDER', barrier: '6', threshold: '5' },
    { file: 'king-fisher-under-7.xml', contract: 'DIGITUNDER', barrier: '7', threshold: '6' },
] as const;

describe('King Fisher bundled templates', () => {
    it.each(templates)('keeps $file aligned with its scanner barrier', template => {
        const xml = fs.readFileSync(
            path.resolve(__dirname, '../../public/bots', template.file),
            'utf8',
        );

        expect(xml).toContain('<block type="king_fisher_best_market_scanner"');
        expect(xml).toContain(`<field name="TYPE_LIST">${template.contract}</field>`);
        expect(xml).toMatch(
            new RegExp(
                `<value name="PREDICTION">[\\s\\S]*?<field name="NUM">${template.barrier}</field>`,
            ),
        );
        expect(xml).toContain(`<field name="THRESHOLD">${template.threshold}</field>`);
        expect(xml).toContain('<block type="after_purchase"');
        expect(xml).toContain('<block type="trade_again"');
    });
});