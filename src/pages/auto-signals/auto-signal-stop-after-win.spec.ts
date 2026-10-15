import fs from 'node:fs';
import path from 'node:path';

describe('Auto-Signals suggested run policy', () => {
    it('continues after wins and losses until the configured run cap', () => {
        const source = fs.readFileSync(
            path.resolve(
                process.cwd(),
                'src/external/bot-skeleton/scratch/blocks/Binary/After Purchase/after_purchase.js',
            ),
            'utf8',
        );
        const startMarker =
            'window.Blockly.JavaScript.javascriptGenerator.forBlock.after_purchase = block => {';
        const start = source.indexOf(startMarker);
        const end = source.indexOf('\n};', start);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);

        const generatorSource = source.slice(start, end + 3);
        const afterPurchaseBlock = {
            type: 'after_purchase',
            id: 'as_after_purchase',
            data: 'auto-signal-v1;max-runs=7',
        };
        const runCount = { name: 'AUTO_SIGNAL_RUN_COUNT', getId: () => 'run_count' };
        const workspace = {
            getAllBlocks: () => [afterPurchaseBlock],
            getVariableMap: () => ({ getVariables: () => [runCount] }),
        };
        const mockWindow = {
            Blockly: {
                derivWorkspace: workspace,
                Variables: { CATEGORY_NAME: 'VARIABLE' },
                JavaScript: {
                    variableDB_: { getName: (id: string) => `v_${id}` },
                    javascriptGenerator: {
                        statementToCode: () => '',
                        forBlock: {} as Record<string, unknown>,
                    },
                },
            },
        };
        const createGenerator = new Function(
            'window',
            `${generatorSource}\nreturn window.Blockly.JavaScript.javascriptGenerator.forBlock.after_purchase;`,
        ) as (windowObject: typeof mockWindow) => (block: any) => string;
        const generator = createGenerator(mockWindow);
        const generatedCode = generator({ ...afterPurchaseBlock, workspace });

        expect(generatedCode).toContain('Number(v_run_count) >= 7');
        expect(generatedCode).not.toContain('Bot.isResult("win")');
        expect(generatedCode).toContain('Bot.isTradeAgain(false); return false;');
        expect(generatedCode).toContain('Bot.isTradeAgain(true); return true;');
    });
});
