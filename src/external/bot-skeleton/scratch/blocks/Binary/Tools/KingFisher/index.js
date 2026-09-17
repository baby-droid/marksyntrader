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
        'var kingFisherEntryState = { lastEpoch: null, streak: 0, digits: [] };',
        `function ${generator().FUNCTION_NAME_PLACEHOLDER_}(direction, threshold, streakMode) {`,
        '  var tick = Bot.getLastTick(true);',
        '  if (!tick || tick.epoch == null) return false;',
        '  var digit = Number(Bot.getLastDigit());',
        '  if (tick.epoch !== kingFisherEntryState.lastEpoch) {',
        '    kingFisherEntryState.lastEpoch = tick.epoch;',
        '    var qualifies = direction === "above" ? digit > threshold : digit < threshold;',
        '    kingFisherEntryState.streak = qualifies ? kingFisherEntryState.streak + 1 : 0;',
        '    kingFisherEntryState.digits.push(digit);',
        '    if (kingFisherEntryState.digits.length > 3) kingFisherEntryState.digits.shift();',
        '    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("bot:king-fisher-analysis", { detail: { symbol: Bot.getSymbol(), digit: digit, sequence: kingFisherEntryState.digits.join(","), threshold: threshold, direction: direction, streak: kingFisherEntryState.streak, met: (streakMode === "2" ? kingFisherEntryState.streak === 2 : streakMode === "3" ? kingFisherEntryState.streak === 3 : (kingFisherEntryState.streak === 2 || kingFisherEntryState.streak === 3)) } }));',
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

window.Blockly.Blocks.king_fisher_best_market_scanner = {
    init() {
        this.jsonInit({
            message0: localize('King Fisher Best Market %1'),
            args0: [{
                type: 'field_dropdown',
                name: 'ENABLED',
                options: [[localize('enabled'), 'TRUE'], [localize('disabled'), 'FALSE']],
            }],
            previousStatement: null,
            nextStatement: null,
            colour: '#0ea5e9',
            tooltip: localize('When enabled, the King Fisher runner scans plain, 1s, Jump, Bear and Bull markets before starting and selects the strongest current digit pattern.'),
            helpUrl: '',
        });
    },
    meta() {
        return {
            display_name: localize('King Fisher Best Market'),
            description: localize('Selects the best live market for this King Fisher contract type before the bot starts.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.king_fisher_best_market_scanner = block => {
    const enabled = block.getFieldValue('ENABLED') !== 'FALSE';
    return enabled ? '/* King Fisher best-market selection is applied by the authenticated runner before start. */\n' : '';
};

window.Blockly.Blocks.king_fisher_restart_trade = {
    init() {
        this.jsonInit({
            message0: localize('King Fisher Restart Trade: TP %1 SL %2 × loss %3'),
            args0: [
                { type: 'input_value', name: 'TAKE_PROFIT', check: 'Number' },
                { type: 'input_value', name: 'STOP_LOSS', check: 'Number' },
                { type: 'field_dropdown', name: 'MULTIPLIER', options: [['1.5×', '1.5'], ['2×', '2'], ['3×', '3']] },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: '#f97316',
            tooltip: localize('Stops on take profit or stop loss. The existing loss branch multiplies the next stake and resets the stake after a win.'),
            helpUrl: '',
        });
    },
    meta() {
        return {
            display_name: localize('King Fisher Restart Trade'),
            description: localize('King Fisher session TP/SL guard with visible loss multiplier settings.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.king_fisher_restart_trade = block => {
    const tp = generator().valueToCode(block, 'TAKE_PROFIT', generator().ORDER_ATOMIC) || '0';
    const sl = generator().valueToCode(block, 'STOP_LOSS', generator().ORDER_ATOMIC) || '0';
    const multiplier = Number(block.getFieldValue('MULTIPLIER') || 2);
    return [
        `if (Number(${tp}) > 0 && Bot.getTotalProfit(false) >= Number(${tp})) { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("journal:signal", { detail: { type: "WIN", label: "TAKE PROFIT HIT", detail: "Keep trading with the best — TP reached" } })); return false; }`,
        `if (Number(${sl}) > 0 && Bot.getTotalProfit(false) <= -Number(${sl})) { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("journal:signal", { detail: { type: "LOSS", label: "STOP LOSS HIT", detail: "Trading stopped at the configured limit" } })); return false; }`,
        `/* King Fisher loss multiplier ${multiplier}x is applied by the following result branch. */`,
    ].join('\n');
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
        '    kingFisherHookState.confirmations = signal ? kingFisherHookState.confirmations + 1 : 0;',
        '    if (typeof Bot.recordVirtualHook === "function") Bot.recordVirtualHook({ id: tick.epoch, time: new Date(tick.epoch * 1000).toISOString(), market: Bot.getSymbol(), result: signal ? "won" : "lost", hookType: "KING_FISHER" });',
        '  }',
        '  return kingFisherHookState.confirmations >= required;',
        '}',
    ]);
    return [
        `${helperName}(${signal}, ${enabled}, ${confirmations})`,
        generator().ORDER_FUNCTION_CALL,
    ];
};