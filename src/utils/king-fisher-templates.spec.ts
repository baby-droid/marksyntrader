import fs from 'fs';
import path from 'path';
import { scoreKingFisherDigits } from './king-fisher-market-scanner';
import { buildKingFisherRestartTradeCode } from './king-fisher-restart-trade-code';

jest.mock('@/external/bot-skeleton', () => ({
    api_base: { api: null },
}));

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

describe('Normal Killer Bot V3 template', () => {
    it('rotates Continuous Indices and gates one Over 1 purchase behind Virtual Hook', () => {
        const xml = fs.readFileSync(
            path.resolve(__dirname, '../../public/bots/normal-killer-bot-v3.xml'),
            'utf8',
        );

        expect(xml).toContain('<field name="SYMBOL_LIST">1HZ15V</field>');
        expect(xml).toContain('<field name="ALTERNATE_MARKETS">TRUE</field>');
        expect(xml).toContain('<field name="ALTERNATE_MODE">EVERY_X_RUNS</field>');
        expect(xml).toContain('<field name="ALTERNATE_EVERY">1</field>');
        expect(xml).toContain('<block type="king_fisher_virtual_hook"');
        expect(xml).toContain('<field name="RESULT">LOSS</field>');
        expect(xml).toContain('<field name="PURCHASE_LIST">DIGITOVER</field>');
        const beforePurchaseStart = xml.indexOf('<block type="before_purchase"');
        const afterPurchaseStart = xml.indexOf('<block type="after_purchase"');
        const beforePurchase = xml.slice(beforePurchaseStart, afterPurchaseStart);
        expect(beforePurchase).toMatch(/<value name="IF0">\s*<block type="king_fisher_virtual_hook"/);
        expect(beforePurchase).toMatch(
            /<statement name="DO0">\s*<block type="purchase" id="nkv3_purchase">\s*<field name="PURCHASE_LIST">DIGITOVER<\/field>/,
        );
        expect(beforePurchase.match(/<block type="purchase"/g) ?? []).toHaveLength(1);
        expect(xml).toContain('<block type="trade_again"');
        expect(xml).not.toContain('<block type="multiple_purchase"');
    });
});

describe('King Fisher restart trade code', () => {
    it('keeps the take-profit and stop-loss guards in one Blockly statement', () => {
        const code = buildKingFisherRestartTradeCode('takeProfit', 'stopLoss', 2);

        expect(typeof code).toBe('string');
        expect(code).toContain('Bot.getTotalProfit(false) >= Number(takeProfit)');
        expect(code).toContain('Bot.getTotalProfit(false) <= -Number(stopLoss)');
        expect(code).toContain('STOP LOSS HIT');
        expect(code).toContain('Next stake uses 2× martingale');
    });
});

describe('King Fisher market scoring', () => {
    it('scores low-digit streaks for BELOW entries', () => {
        const result = scoreKingFisherDigits([1, 2, 0, 8], 'BELOW', 3);

        expect(result.longestStreak).toBe(3);
        expect(result.qualifyingTicks).toBe(3);
        expect(result.lastDigit).toBe(8);
    });

    it('scores high-digit streaks for ABOVE entries', () => {
        const result = scoreKingFisherDigits([7, 8, 9, 2], 'ABOVE', 6);

        expect(result.longestStreak).toBe(3);
        expect(result.qualifyingTicks).toBe(3);
        expect(result.lastDigit).toBe(2);
    });
});

describe('King Fisher virtual-hook purchase gate', () => {
    it('uses a one-cycle authorization before the nested real purchase', () => {
        const source = fs.readFileSync(
            path.resolve(
                __dirname,
                '../external/bot-skeleton/scratch/blocks/Binary/Tools/KingFisher/index.js',
            ),
            'utf8',
        );

        expect(source).toContain('purchaseAuthorized: false');
        expect(source).toContain('if (state.purchaseAuthorized)');
        expect(source).toContain('state.purchaseAuthorized = true;');
        expect(source).toContain('state.purchaseAuthorizationEpoch = tick.epoch;');
        expect(source).toContain('hookType: result === "won" ? "HOOK PROFIT" : "HOOK LOSS"');
        expect(source).toContain('state.confirmations = 0;');
        expect(source).toMatch(
            /if \(state\.purchaseAuthorized\) \{[\s\S]*?state\.purchaseAuthorized = false;[\s\S]*?return true;/,
        );
        expect(source).toMatch(
            /state\.purchaseAuthorized = true;[\s\S]*?return false;/,
        );
    });

    it('keeps the runtime stake handoff behind the visible XML result blocks', () => {
        const source = fs.readFileSync(
            path.resolve(
                __dirname,
                '../external/bot-skeleton/scratch/blocks/Binary/After Purchase/after_purchase.js',
            ),
            'utf8',
        );

        expect(source).toContain('kingFisherSettledStake');
        expect(source).toContain('Number(kingFisherSettledStake) * Number(${martingaleVariable})');
        expect(source).toContain('Bot.isResult("win")');
    });

    it.each(['PROFIT', 'LOSS'])(
        'keeps %s as a selectable hook result',
        result => {
            const hookSource = fs.readFileSync(
                path.resolve(
                    __dirname,
                    '../external/bot-skeleton/scratch/blocks/Binary/Tools/KingFisher/index.js',
                ),
                'utf8',
            );

            expect(hookSource).toContain(
                `[localize('Hook ${result === 'PROFIT' ? 'profit' : 'loss'}'), '${result}']`,
            );
        },
    );
});