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
    it('keeps the bundled recovery block bound to the canonical cycle phase', () => {
        const xml = readFileSync(
            resolve(__dirname, '../../../public/bots/two-prediction-cycle.xml'),
            'utf8',
        );

        expect(xml).toContain('<variable id="tp2_phase">recovery_phase</variable>');
        expect(xml).toContain('<field name="PHASE" id="tp2_phase">recovery_phase</field>');
        expect(xml).not.toContain('recovery_phase2');
    });

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
        // The stale variable ID is deliberately absent from the variable map:
        // older workspaces can retain a field pointing at a deleted model.
        const namesById = Object.fromEntries([
            ...variableDefinitions,
            ['phase2', 'recovery_phase2'],
        ]);
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
        let phaseRouterVariableId = 'phase2';
        const phaseRouterField = {
            name: 'VAR',
            getValue: () => phaseRouterVariableId,
            getText: () => namesById[phaseRouterVariableId],
            setValue: (id: string) => {
                phaseRouterVariableId = id;
            },
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
            {
                type: 'variables_get',
                inputList: [{ fieldRow: [phaseRouterField] }],
                getFieldValue: () => phaseRouterVariableId,
            },
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
                        statementToCode: () => `var phaseRouterState = v_${phaseRouterVariableId};`,
                        ORDER_ATOMIC: 0,
                    },
                },
            },
        };
        const workspace = {
            getAllBlocks: () => blocks,
            getVariableMap: () => ({
                getVariables: () => variables,
                createVariable: (name: string) => {
                    const id = `created_${name}`;
                    const variable = { name, getId: () => id };
                    variables.push(variable);
                    namesById[id] = name;
                    return variable;
                },
            }),
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
        expect(generatedCode).toContain('Number(v_created_recovery_phase)');
        expect(generatedCode).toContain('var phaseRouterState = v_created_recovery_phase;');
        expect(generatedCode).not.toContain('v_phase2');
        expect(generatedCode).not.toContain('recovery_phase2');
        expect(recoveryFieldValues.PHASE).toBe('created_recovery_phase');
        expect(recoveryFieldValues.LOSS_COUNT).toBe('created_paired_loss_count');
        expect(phaseRouterVariableId).toBe('created_recovery_phase');
    });
});

describe('2 Prediction Cycle paired-entry flow', () => {
    const xml = readFileSync(
        resolve(__dirname, '../../../public/bots/two-prediction-cycle.xml'),
        'utf8',
    );
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const getBlock = (id: string) =>
        Array.from(doc.getElementsByTagNameNS('https://developers.google.com/blockly/xml', 'block'))
            .find(block => block.getAttribute('id') === id);
    const readFields = (block: Element | undefined) =>
        Object.fromEntries(
            Array.from(block?.getElementsByTagNameNS('https://developers.google.com/blockly/xml', 'field') ?? [])
                .map(field => [field.getAttribute('name') || '', field.textContent || '']),
        );
    const readStakeVariables = (block: Element | undefined) =>
        Array.from(block?.getElementsByTagNameNS('https://developers.google.com/blockly/xml', 'block') ?? [])
            .filter(child => child.getAttribute('type') === 'variables_get')
            .map(child => Array.from(child.getElementsByTagNameNS('https://developers.google.com/blockly/xml', 'field'))
                .find(field => field.getAttribute('name') === 'VAR')?.textContent);

    it('routes Over 1/2 and Under 8/7 as distinct simultaneous pairs with their own stakes', () => {
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(readFields(getBlock('tp2_over_pair'))).toMatchObject({
            CONTRACT_1: 'DIGITOVER',
            PREDICTION_1: '1',
            CONTRACT_2: 'DIGITOVER',
            PREDICTION_2: '2',
        });
        expect(readStakeVariables(getBlock('tp2_over_pair'))).toEqual(['over_1_stake', 'over_2_stake']);
        expect(readFields(getBlock('tp2_under_pair'))).toMatchObject({
            CONTRACT_1: 'DIGITUNDER',
            PREDICTION_1: '8',
            CONTRACT_2: 'DIGITUNDER',
            PREDICTION_2: '7',
        });
        expect(readStakeVariables(getBlock('tp2_under_pair'))).toEqual(['under_8_stake', 'under_7_stake']);
    });

    it('generates a same-entry paired purchase with each configured stake passed independently', () => {
        const toolsSource = readFileSync(
            resolve(__dirname, '../../external/bot-skeleton/scratch/blocks/Binary/Tools/KingFisher/index.js'),
            'utf8',
        );
        const startMarker =
            'window.Blockly.JavaScript.javascriptGenerator.forBlock.king_fisher_pair_purchase_with_stakes = block => {';
        const start = toolsSource.indexOf(startMarker);
        const end = toolsSource.indexOf('\n};', start);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);

        const generatorSource = toolsSource.slice(start, end + 3);
        const mockWindow = {
            Blockly: {
                JavaScript: {
                    javascriptGenerator: {
                        ORDER_ATOMIC: 0,
                        valueToCode: (block: any, inputName: string) => block.stakes[inputName],
                        forBlock: {} as Record<string, unknown>,
                    },
                },
            },
        };
        const createGenerator = new Function(
            'window',
            `${generatorSource}\nreturn window.Blockly.JavaScript.javascriptGenerator.forBlock.king_fisher_pair_purchase_with_stakes;`,
        ) as (windowObject: typeof mockWindow) => (block: any) => string;
        const generator = createGenerator(mockWindow);
        const overCode = generator({
            getFieldValue: (name: string) => ({
                CONTRACT_1: 'DIGITOVER',
                PREDICTION_1: '1',
                CONTRACT_2: 'DIGITOVER',
                PREDICTION_2: '2',
            })[name],
            stakes: { STAKE_1: 'over1Stake', STAKE_2: 'over2Stake' },
        });
        const underCode = generator({
            getFieldValue: (name: string) => ({
                CONTRACT_1: 'DIGITUNDER',
                PREDICTION_1: '8',
                CONTRACT_2: 'DIGITUNDER',
                PREDICTION_2: '7',
            })[name],
            stakes: { STAKE_1: 'under8Stake', STAKE_2: 'under7Stake' },
        });

        expect(overCode).toContain('amount: (over1Stake), prediction: 1');
        expect(overCode).toContain('amount: (over2Stake), prediction: 2');
        expect(underCode).toContain('amount: (under8Stake), prediction: 8');
        expect(underCode).toContain('amount: (under7Stake), prediction: 7');
        expect(overCode.match(/same_tick_pair: true/g)).toHaveLength(2);
        expect(underCode.match(/same_tick_pair: true/g)).toHaveLength(2);
    });
});
