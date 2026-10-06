import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildTwoPredictionPairMartingaleCode } from '../two-prediction-cycle-martingale';

const bindings = [
    { current: 'over1Stake', base: 'over1Base' },
    { current: 'over2Stake', base: 'over2Base' },
    { current: 'under8Stake', base: 'under8Base' },
    { current: 'under7Stake', base: 'under7Base' },
];

const runStakeProgression = (
    pairResult: boolean | null,
    current: number[],
    base: number[],
    martingale: number,
): number[] => {
    const code = buildTwoPredictionPairMartingaleCode(bindings, 'martingale');
    const execute = new Function(
        'Bot',
        'over1Stake',
        'over2Stake',
        'under8Stake',
        'under7Stake',
        'over1Base',
        'over2Base',
        'under8Base',
        'under7Base',
        'martingale',
        `${code}\nreturn [over1Stake, over2Stake, under8Stake, under7Stake];`,
    ) as (...args: unknown[]) => number[];

    return execute(
        { isKingFisherPairWin: () => pairResult },
        ...current,
        ...base,
        martingale,
    );
};

describe('2 Prediction Cycle martingale', () => {
    it('multiplies every leg after a net pair loss', () => {
        expect(runStakeProgression(false, [1, 2, 3, 4], [0.5, 0.75, 1, 1.25], 2))
            .toEqual([2, 4, 6, 8]);
    });

    it('resets every leg to its own editable base stake after a pair win', () => {
        expect(runStakeProgression(true, [2, 4, 6, 8], [0.5, 0.75, 1, 1.25], 2))
            .toEqual([0.5, 0.75, 1, 1.25]);
    });

    it('leaves stakes unchanged when pair settlement is not available', () => {
        expect(runStakeProgression(null, [1, 2, 3, 4], [0.5, 0.75, 1, 1.25], 2))
            .toEqual([1, 2, 3, 4]);
    });

    it('prevents a configured multiplier below 1 from reducing stakes', () => {
        expect(runStakeProgression(false, [1, 2, 3, 4], [0.5, 0.75, 1, 1.25], 0.5))
            .toEqual([1, 2, 3, 4]);
    });

    it('generates the after-purchase block without the variableName temporal-dead-zone error', () => {
        const sourcePath = resolve(
            __dirname,
            '../../external/bot-skeleton/scratch/blocks/Binary/After Purchase/after_purchase.js',
        );
        const source = readFileSync(sourcePath, 'utf8');
        const startMarker = 'window.Blockly.JavaScript.javascriptGenerator.forBlock.after_purchase = block => {';
        const start = source.indexOf(startMarker);
        const endMarker = '\n};';
        const end = source.indexOf(endMarker, start);

        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);

        const generatorSource = source.slice(start, end + endMarker.length);
        const variableDefinitions = [
            ['phase', 'recovery_phase'],
            ['phase2', 'recovery_phase2'],
            ['loss', 'paired_loss_count'],
            ['stake', 'stake'],
            ['martingale', 'martingale'],
            ['over1', 'over_1_stake'],
            ['over1Base', 'over_1_base_stake'],
            ['over2', 'over_2_stake'],
            ['over2Base', 'over_2_base_stake'],
            ['under8', 'under_8_stake'],
            ['under8Base', 'under_8_base_stake'],
            ['under7', 'under_7_stake'],
            ['under7Base', 'under_7_base_stake'],
        ];
        const variables = variableDefinitions.map(([id, name]) => ({
            name,
            getId: () => id,
        }));
        const namesById = Object.fromEntries(variableDefinitions);
        const recoveryFieldValues: Record<string, string> = {
            PHASE: 'phase2',
            LOSS_COUNT: 'loss',
            RECOVERY_PHASE: '0',
            RECOVERY_PHASE_2: '1',
            INTERMEDIATE_PHASE_1: '2',
            INTERMEDIATE_PHASE_2: '3',
            FIRST_OVER3_PHASE: '4',
            SECOND_OVER3_PHASE: '5',
            RETURN_PHASE: '0',
            USE_PAIR_RESULT: 'TRUE',
        };
        const recoveryBlock = {
            type: 'king_fisher_recovery_escalation',
            getFieldValue: (name: string) => recoveryFieldValues[name],
            getField: (name: string) => ({
                getText: () => namesById[recoveryFieldValues[name]],
                setValue: (id: string) => {
                    recoveryFieldValues[name] = id;
                },
            }),
        };
        const blocks = [
            { type: 'king_fisher_pair_purchase_with_stakes' },
            recoveryBlock,
            { type: 'king_fisher_restart_trade' },
            {
                type: 'trade_definition_tradeoptions',
                getInputTargetBlock: () => ({ getFieldValue: () => '1' }),
            },
        ];
        const mockWindow = {
            Blockly: {
                Variables: { CATEGORY_NAME: 'VARIABLE' },
                JavaScript: {
                    variableDB_: { getName: (id: string) => `v_${id}` },
                    javascriptGenerator: {
                        forBlock: { variables_get: () => ['0'] },
                        statementToCode: () => '',
                        ORDER_ATOMIC: 0,
                    },
                },
            },
        };
        const workspace = {
            getAllBlocks: () => blocks,
            getVariableMap: () => ({ getVariables: () => variables }),
        };
        const createGenerator = new Function(
            'window',
            'buildTwoPredictionPairMartingaleCode',
            `${generatorSource}\nreturn window.Blockly.JavaScript.javascriptGenerator.forBlock.after_purchase;`,
        ) as (
            windowObject: typeof mockWindow,
            builder: typeof buildTwoPredictionPairMartingaleCode,
        ) => (block: { id: string; workspace: typeof workspace }) => string;

        const generator = createGenerator(mockWindow, buildTwoPredictionPairMartingaleCode);
        const generatedCode = generator({ id: 'tp2_after', workspace });

        expect(generatedCode).toContain('Bot.isKingFisherPairWin()');
        expect(generatedCode).toContain('v_over1 = v_over1 * twoPredictionMartingaleFactor');
        expect(generatedCode).toContain('Number(v_phase)');
        expect(generatedCode).not.toContain('recovery_phase2');
        expect(recoveryFieldValues.PHASE).toBe('phase');
    });
});
