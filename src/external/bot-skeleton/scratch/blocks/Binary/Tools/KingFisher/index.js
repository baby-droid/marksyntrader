import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../../utils';

const generator = () => window.Blockly.JavaScript.javascriptGenerator;

const ensureHelper = (name, code) => generator().provideFunction_(name, code);

window.Blockly.Blocks.king_fisher_entry = {
    init() {
        this.jsonInit({
            message0: localize('King Fisher entry: %1 %2 with a %3-digit streak'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'DIRECTION',
                    options: [
                        [localize('digits below'), 'BELOW'],
                        [localize('digits above'), 'ABOVE'],
                    ],
                },
                {
                    type: 'field_dropdown',
                    name: 'THRESHOLD',
                    options: [['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']],
                },
                {
                    type: 'field_dropdown',
                    name: 'STREAK',
                    options: [
                        [localize('2 or 3'), '2_3'],
                        [localize('exactly 2'), '2'],
                        [localize('exactly 3'), '3'],
                    ],
                },
            ],
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: '#f59e0b',
            tooltip: localize(
                'Detects two or three consecutive last digits on the selected side of the threshold. This reads digit history, not the raw price.'
            ),
            helpUrl: '',
        });
    },
    meta() {
        return {
            display_name: localize('King Fisher entry'),
            description: localize(
                'Detects a 2- or 3-digit consecutive pattern below or above a configurable threshold.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.king_fisher_entry = block => {
    const direction = block.getFieldValue('DIRECTION') === 'ABOVE' ? 'above' : 'below';
    const threshold = Number(block.getFieldValue('THRESHOLD') || 3);
    const streak = block.getFieldValue('STREAK') || '2_3';
    const helperName = ensureHelper('kingFisherEntry', [
        'var kingFisherEntryState = { lastEpoch: null, streak: 0 };',
        `function ${generator().FUNCTION_NAME_PLACEHOLDER_}(direction, threshold, streakMode) {`,
        '  var tick = Bot.getLastTick(true);',
        '  if (!tick || tick.epoch == null) return false;',
        '  var digit = Number(Bot.getLastDigit());',
        '  if (tick.epoch !== kingFisherEntryState.lastEpoch) {',
        '    kingFisherEntryState.lastEpoch = tick.epoch;',
        '    var qualifies = direction === "above" ? digit > threshold : digit < threshold;',
        '    kingFisherEntryState.streak = qualifies ? kingFisherEntryState.streak + 1 : 0;',
        '  }',
        '  if (streakMode === "2") return kingFisherEntryState.streak === 2;',
        '  if (streakMode === "3") return kingFisherEntryState.streak === 3;',
        '  return kingFisherEntryState.streak === 2 || kingFisherEntryState.streak === 3;',
        '}',
    ]);
    return [
        `${helperName}('${direction}', ${threshold}, '${streak}')`,
        generator().ORDER_FUNCTION_CALL,
    ];
};

window.Blockly.Blocks.king_fisher_virtual_hook = {
    init() {
        this.jsonInit({
            message0: localize('King Fisher Virtual Hook %1 after %2 signal %3'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'ENABLED',
                    options: [
                        [localize('enabled'), 'TRUE'],
                        [localize('disabled'), 'FALSE'],
                    ],
                },
                {
                    type: 'field_dropdown',
                    name: 'CONFIRMATIONS',
                    options: [
                        [localize('1 tick'), '1'],
                        [localize('2 ticks'), '2'],
                    ],
                },
                {
                    type: 'input_value',
                    name: 'SIGNAL',
                    check: 'Boolean',
                },
            ],
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: '#7c3aed',
            tooltip: localize(
                'The Virtual Hook confirms an entry signal before allowing a real purchase. It never sends a purchase by itself.'
            ),
            helpUrl: '',
        });
    },
    meta() {
        return {
            display_name: localize('King Fisher Virtual Hook'),
            description: localize(
                'Optional confirmation gate for King Fisher entries. Use it around the King Fisher entry block.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.king_fisher_virtual_hook = block => {
    const enabled = block.getFieldValue('ENABLED') !== 'FALSE';
    const confirmations = Math.max(1, Number(block.getFieldValue('CONFIRMATIONS') || 1));
    const signal =
        generator().valueToCode(block, 'SIGNAL', generator().ORDER_ATOMIC) || 'false';
    const helperName = ensureHelper('kingFisherVirtualHook', [
        'var kingFisherHookState = { lastEpoch: null, confirmations: 0 };',
        `function ${generator().FUNCTION_NAME_PLACEHOLDER_}(signal, enabled, required) {`,
        '  if (!enabled) return Boolean(signal);',
        '  var tick = Bot.getLastTick(true);',
        '  if (!tick || tick.epoch == null || !signal) {',
        '    kingFisherHookState.confirmations = 0;',
        '    return false;',
        '  }',
        '  if (tick.epoch !== kingFisherHookState.lastEpoch) {',
        '    kingFisherHookState.lastEpoch = tick.epoch;',
        '    kingFisherHookState.confirmations += 1;',
        '  }',
        '  return kingFisherHookState.confirmations >= required;',
        '}',
    ]);
    return [
        `${helperName}(${signal}, ${enabled}, ${confirmations})`,
        generator().ORDER_FUNCTION_CALL,
    ];
};