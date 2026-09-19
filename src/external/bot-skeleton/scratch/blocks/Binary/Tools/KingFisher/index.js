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
                    options: [
                        ['0', '0'],
                        ['1', '1'],
                        ['2', '2'],
                        ['3', '3'],
                        ['4', '4'],
                        ['5', '5'],
                        ['6', '6'],
                        ['7', '7'],
                        ['8', '8'],
                        ['9', '9'],
                    ],
                },
                {
                    type: 'field_dropdown',
                    name: 'STREAK',
                    options: [
                        [localize('exactly 1'), '1'],
                        [localize('1 or 2'), '1_2'],
                        [localize('2 or 3'), '2_3'],
                        [localize('exactly 2'), '2'],
                        [localize('exactly 3'), '3'],
                        [localize('3 or 4'), '3_4'],
                        [localize('exactly 4'), '4'],
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
                'Detects a configurable 1-, 2-, 3- or 4-digit consecutive pattern below or above a configurable threshold.'
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
        'var kingFisherEntryStates = {};',
        `function ${generator().FUNCTION_NAME_PLACEHOLDER_}(key, direction, threshold, streakMode) {`,
        '  var state = kingFisherEntryStates[key] || (kingFisherEntryStates[key] = { lastEpoch: null, streak: 0, digits: [] });',
        '  var tick = Bot.getLastTick(true);',
        '  if (!tick || tick.epoch == null) return false;',
        '  var digit = Number(Bot.getLastDigit());',
        '  if (typeof digit !== "number" || digit !== digit || digit === Infinity || digit === -Infinity) return false;',
        '  if (tick.epoch !== state.lastEpoch) {',
        '    state.lastEpoch = tick.epoch;',
        '    var qualifies = direction === "above" ? digit > threshold : digit < threshold;',
        '    state.streak = qualifies ? state.streak + 1 : 0;',
        '    state.digits.push(digit);',
        '    if (state.digits.length > 4) state.digits.shift();',
        '    if (typeof Bot.emitMarketDigit === "function") Bot.emitMarketDigit({ symbol: Bot.getSymbol(), digit: digit, epoch: tick.epoch });',
        '    if (typeof Bot.emitKingFisherAnalysis === "function") Bot.emitKingFisherAnalysis({ symbol: Bot.getSymbol(), digit: digit, sequence: state.digits.join(","), threshold: threshold, direction: direction, streak: state.streak, met: (streakMode === "1" ? state.streak === 1 : streakMode === "1_2" ? (state.streak === 1 || state.streak === 2) : streakMode === "2" ? state.streak === 2 : streakMode === "3" ? state.streak === 3 : streakMode === "3_4" ? (state.streak === 3 || state.streak === 4) : streakMode === "4" ? state.streak === 4 : (state.streak === 2 || state.streak === 3)) });',
        '  }',
        '  if (streakMode === "1") return state.streak === 1;',
        '  if (streakMode === "1_2") return state.streak === 1 || state.streak === 2;',
        '  if (streakMode === "2") return state.streak === 2;',
        '  if (streakMode === "3") return state.streak === 3;',
        '  if (streakMode === "3_4") return state.streak === 3 || state.streak === 4;',
        '  if (streakMode === "4") return state.streak === 4;',
        '  return state.streak === 2 || state.streak === 3;',
        '}',
    ]);
    return [
        `${helperName}('${block.id}', '${direction}', ${threshold}, '${streak}')`,
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
        `if (Number(${tp}) > 0 && Bot.getTotalProfit(false) >= Number(${tp})) { if (typeof Bot.emitJournalSignal === "function") Bot.emitJournalSignal({ type: "WIN", label: "TAKE PROFIT HIT", detail: "Keep trading with the best — TP reached" }); if (typeof Bot.requestKingFisherRescan === "function") Bot.requestKingFisherRescan({ reason: "take-profit", profit: Bot.getTotalProfit(false) }); return false; }`,
        `if (Number(${sl}) > 0 && Bot.getTotalProfit(false) <= -Number(${sl})) { if (typeof Bot.emitJournalSignal === "function") Bot.emitJournalSignal({ type: "LOSS", label: "STOP LOSS HIT", detail: "Trading stopped at the configured limit" }); if (typeof Bot.requestKingFisherRescan === "function") Bot.requestKingFisherRescan({ reason: "stop-loss", profit: Bot.getTotalProfit(false) }); return false; }`,
        `if (typeof Bot.emitJournalSignal === "function") Bot.emitJournalSignal({ type: Bot.isResult("win") ? "WIN" : "LOSS", label: Bot.isResult("win") ? "TRADE WON" : "TRADE LOST", detail: Bot.isResult("win") ? "Stake reset to base" : "Next stake uses ${multiplier}× martingale" });`,
        `/* The following King Fisher result blocks own the stake variable. The ${multiplier}× setting is retained here for the journal and XML-visible risk control. */`,
    ].join('\n');
};

window.Blockly.Blocks.king_fisher_virtual_hook = {
    init() {
        this.jsonInit({
            message0: localize('King Fisher Virtual Hook %1 after %2 %3 signal %4'),
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
                    type: 'field_dropdown',
                    name: 'RESULT',
                    options: [
                        [localize('Hook profit'), 'PROFIT'],
                        [localize('Hook loss'), 'LOSS'],
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
    const targetResult = block.getFieldValue('RESULT') === 'PROFIT' ? 'profit' : 'loss';
    const signal =
        generator().valueToCode(block, 'SIGNAL', generator().ORDER_ATOMIC) || 'false';
    const workspaceBlocks = block.workspace?.getAllBlocks?.() ?? [];
    const contractBlock = workspaceBlocks.find(candidate => candidate.type === 'trade_definition_contracttype');
    const optionsBlock = workspaceBlocks.find(candidate => candidate.type === 'trade_definition_tradeoptions');
    const contractType = contractBlock?.getFieldValue?.('TYPE_LIST') || 'DIGITOVER';
    const predictionBlock = optionsBlock?.getInputTargetBlock?.('PREDICTION');
    const barrier = Number(predictionBlock?.getFieldValue?.('NUM') || 0);
    const helperName = ensureHelper('kingFisherVirtualHook', [
        'var kingFisherHookStates = {};',
        `function ${generator().FUNCTION_NAME_PLACEHOLDER_}(key, signal, enabled, required, targetResult, contractType, barrier) {`,
        '  if (!enabled) return Boolean(signal);',
        '  var state = kingFisherHookStates[key] || (kingFisherHookStates[key] = { lastEpoch: null, pendingEpoch: null, pendingDigit: null, confirmations: 0 });',
        '  var tick = Bot.getLastTick(true);',
        '  if (!tick || tick.epoch == null) {',
        '    state.confirmations = 0;',
        '    return false;',
        '  }',
        '  if (state.pendingEpoch != null && tick.epoch !== state.pendingEpoch) {',
        '    var exitDigit = Number(Bot.getLastDigit());',
        '    var exitDigitIsFinite = typeof exitDigit === "number" && exitDigit === exitDigit && exitDigit !== Infinity && exitDigit !== -Infinity;',
        '    var hookWon = exitDigitIsFinite && (contractType === "DIGITUNDER" ? exitDigit < barrier : exitDigit > barrier);',
        '    var result = hookWon ? "won" : "lost";',
        '    if (typeof Bot.recordVirtualHook === "function") Bot.recordVirtualHook({ id: state.pendingEpoch, time: new Date(state.pendingEpoch * 1000).toISOString(), market: Bot.getSymbol(), exitDigit: exitDigitIsFinite ? exitDigit : null, result: result, hookType: targetResult === "profit" ? "HOOK PROFIT" : "HOOK LOSS" });',
        '    state.pendingEpoch = null;',
        '    state.pendingDigit = null;',
        '    state.confirmations = result === targetResult ? state.confirmations + 1 : 0;',
        '    return state.confirmations >= required;',
        '  }',
        '  if (Boolean(signal) && state.pendingEpoch == null && tick.epoch !== state.lastEpoch) {',
        '    state.lastEpoch = tick.epoch;',
        '    state.pendingEpoch = tick.epoch;',
        '    state.pendingDigit = Number(Bot.getLastDigit());',
        '  }',
        '  return false;',
        '}',
    ]);
    return [
        `${helperName}('${block.id}', ${signal}, ${enabled}, ${confirmations}, '${targetResult}', '${contractType}', ${barrier})`,
        generator().ORDER_FUNCTION_CALL,
    ];
};