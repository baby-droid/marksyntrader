import fs from 'fs';
import path from 'path';
import { getKingFisherDigitSetup, scoreKingFisherDigits } from './king-fisher-market-scanner';
import { buildKingFisherRestartTradeCode } from './king-fisher-restart-trade-code';
import { normalizeKingFisherXml } from './king-fisher-xml-normalizer';

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

    it.each(templates)('normalizes $file without replacing its existing strategy blocks', template => {
        const source = fs.readFileSync(
            path.resolve(__dirname, '../../public/bots', template.file),
            'utf8',
        );
        const originalDoc = new DOMParser().parseFromString(source, 'application/xml');
        const normalizedDoc = new DOMParser().parseFromString(
            normalizeKingFisherXml(source),
            'application/xml',
        );
        const namespace = 'https://developers.google.com/blockly/xml';
        const originalIds = Array.from(originalDoc.getElementsByTagNameNS(namespace, 'block'))
            .map(block => block.getAttribute('id'))
            .filter((id): id is string => Boolean(id));
        const normalizedBlocks = Array.from(normalizedDoc.getElementsByTagNameNS(namespace, 'block'));
        const normalizedTypes = normalizedBlocks.map(block => block.getAttribute('type'));
        const normalizedIds = normalizedBlocks
            .map(block => block.getAttribute('id'))
            .filter((id): id is string => Boolean(id));
        const tradeDefinition = normalizedBlocks.find(block => block.getAttribute('type') === 'trade_definition');
        const tradeOptions = Array.from(tradeDefinition?.children ?? [])
            .find(element => element.localName === 'statement' && element.getAttribute('name') === 'TRADE_OPTIONS');
        const afterPurchase = normalizedBlocks.find(block => block.getAttribute('type') === 'after_purchase');
        const afterPurchaseStack = Array.from(afterPurchase?.children ?? [])
            .find(element => element.localName === 'statement' && element.getAttribute('name') === 'AFTERPURCHASE_STACK');
        const firstTradeOption = Array.from(tradeOptions?.children ?? [])
            .find(element => element.localName === 'block');
        const firstAfterPurchase = Array.from(afterPurchaseStack?.children ?? [])
            .find(element => element.localName === 'block');
        const restartValues = Array.from(firstAfterPurchase?.children ?? [])
            .filter(element => element.localName === 'value');
        const restartMultiplier = Array.from(firstAfterPurchase?.children ?? [])
            .find(element => element.localName === 'field' && element.getAttribute('name') === 'MULTIPLIER');

        expect(normalizedDoc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(normalizedIds).toEqual(expect.arrayContaining(originalIds));
        expect(new Set(normalizedIds).size).toBe(normalizedIds.length);
        expect(firstTradeOption?.getAttribute('type')).toBe('king_fisher_best_market_scanner');
        expect(firstAfterPurchase?.getAttribute('type')).toBe('king_fisher_restart_trade');
        expect(restartValues.map(value => value.getAttribute('name'))).toEqual(['TAKE_PROFIT', 'STOP_LOSS']);
        expect(restartValues.every(value => Array.from(value.children)
            .some(block => block.localName === 'block' && block.getAttribute('type') === 'variables_get'))).toBe(true);
        expect(restartMultiplier?.textContent).toBe('2');
        expect(normalizedTypes).toContain('trade_again');
    });
});

describe('Normal Killer Bot V3 template', () => {
    it('uses default Blockly martingale/restart blocks without hook settings', () => {
        const xml = fs.readFileSync(
            path.resolve(__dirname, '../../public/bots/normal-killer-bot-v3.xml'),
            'utf8',
        );
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const blockIds = Array.from(doc.getElementsByTagNameNS(
            'https://developers.google.com/blockly/xml',
            'block',
        ))
            .map((block) => block.getAttribute('id'))
            .filter((id): id is string => typeof id === 'string' && id.length > 0);

        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(new Set(blockIds).size).toBe(blockIds.length);
        expect(xml).toContain('<field name="SYMBOL_LIST">1HZ15V</field>');
        expect(xml).toContain('<field name="ALTERNATE_MARKETS">TRUE</field>');
        expect(xml).toContain('<field name="ALTERNATE_MODE">EVERY_X_RUNS</field>');
        expect(xml).toContain('<field name="ALTERNATE_EVERY">1</field>');
        expect(xml).toContain('<field name="PURCHASE_LIST">DIGITOVER</field>');
        expect(xml).toContain('<data>nkv3-pipeline</data>');
        expect(xml).toContain('<block type="controls_if" id="nkv3_restart_martingale">');
        expect(xml).toContain('<field name="CHECK_RESULT">win</field>');
        expect(xml).toContain('<field name="OP">MULTIPLY</field>');
        expect(xml).toContain('<field name="VAR" id="nkv3_martingale">martingale</field>');
        expect(xml).not.toContain('<block type="king_fisher_restart_trade"');
        expect(xml).not.toContain('king_fisher_virtual_hook');
        expect(xml).toContain('<block type="during_purchase"');
        expect(xml).toContain('normal_killer_tick_acceleration');
        const beforePurchaseStart = xml.indexOf('<block type="before_purchase"');
        const afterPurchaseStart = xml.indexOf('<block type="after_purchase"');
        const beforePurchase = xml.slice(beforePurchaseStart, afterPurchaseStart);
        expect(beforePurchase).toMatch(
            /<statement name="BEFOREPURCHASE_STACK">\s*<block type="normal_killer_tick_acceleration"[\s\S]*?<next>\s*<block type="purchase" id="nkv3_purchase">\s*<field name="PURCHASE_LIST">DIGITOVER<\/field>/,
        );
        expect(beforePurchase.match(/<block type="purchase"/g) ?? []).toHaveLength(1);
        expect(xml).not.toContain('nkv3_increase_stake');
        expect(xml).toContain('<block type="trade_again"');
        expect(xml).not.toContain('<block type="multiple_purchase"');
    });

    it('configures the internal pipeline from bot variables in the before-purchase generator', () => {
        const source = fs.readFileSync(
            path.resolve(
                __dirname,
                '../external/bot-skeleton/scratch/blocks/Binary/Before Purchase/before_purchase.js',
            ),
            'utf8',
        );

        expect(source).toContain("block.data === 'nkv3-pipeline'");
        expect(source).toContain('Bot.configureNormalKillerPipeline');
        expect(source).toContain('Bot.setNormalKillerPurchaseEpoch');
        expect(source).toContain('Bot.getSymbol()');
        expect(source).toContain("candidate.type === 'king_fisher_restart_trade'");
        expect(source).toContain("getFieldValue('MULTIPLIER')");
    });

    it('keeps the pipeline restart and continuous-market rotation when the default Trade again block runs', () => {
        const afterPurchaseSource = fs.readFileSync(
            path.resolve(
                __dirname,
                '../external/bot-skeleton/scratch/blocks/Binary/After Purchase/after_purchase.js',
            ),
            'utf8',
        );
        const tradeAgainSource = fs.readFileSync(
            path.resolve(
                __dirname,
                '../external/bot-skeleton/scratch/blocks/Binary/After Purchase/trade_again.js',
            ),
            'utf8',
        );

        expect(afterPurchaseSource).toContain('isKingFisher || hasNormalKillerPipeline');
        expect(tradeAgainSource).toContain('candidate.type === \'before_purchase\' && candidate.data === \'nkv3-pipeline\'');
        expect(tradeAgainSource).toContain('if (isKingFisher || isNormalKillerPipeline) return');
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

    it('applies the restart block multiplier to the existing martingale variable', () => {
        const source = fs.readFileSync(
            path.resolve(
                __dirname,
                '../external/bot-skeleton/scratch/blocks/Binary/Tools/KingFisher/index.js',
            ),
            'utf8',
        );

        expect(source).toContain("=== 'martingale'");
        expect(source).toContain('${martingaleName} = ${multiplier};');
        expect(source).toContain('return `${multiplierCode}${buildKingFisherRestartTradeCode(tp, sl, multiplier)}`;');
    });
});

describe('King Fisher market scoring', () => {
    it.each([
        { direction: 'BELOW', threshold: '3', contract: 'DIGITOVER', barrier: 3 },
        { direction: 'ABOVE', threshold: '6', contract: 'DIGITUNDER', barrier: 6 },
    ])('uses the existing King Fisher entry block for best-market setup: $contract', setup => {
        expect(getKingFisherDigitSetup([{
            type: 'king_fisher_entry',
            getFieldValue: name => name === 'DIRECTION' ? setup.direction : setup.threshold,
        }])).toEqual({
            contract: setup.contract,
            direction: setup.direction === 'BELOW' ? 'BELOW' : 'ABOVE',
            barrier: setup.barrier,
        });
    });

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
        expect(source).toContain('if (purchaseTiming === "IMMEDIATE") {');
        expect(source).toContain('pipelineMode === "SIDE"');
        expect(source).toContain('Bot.purchaseNormalKillerTick(contractType, Number(tick.epoch))');
        expect(source).toContain('Bot.configureNormalKillerPipeline');
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