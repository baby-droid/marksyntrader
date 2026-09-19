import { localize } from '@deriv-com/translations';
import { appendCollapsedMainBlocksFields, modifyContextMenu } from '../../../utils';
import { finishSign } from '../../images';

window.Blockly.Blocks.after_purchase = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: '%1 %2 %3',
            message1: '%1',
            message2: '%1',
            args0: [
                {
                    type: 'field_image',
                    src: finishSign,
                    width: 25,
                    height: 25,
                    alt: 'F',
                },
                {
                    type: 'field_label',
                    text: localize('4. Restart trading conditions'),
                    class: 'blocklyTextRootBlockHeader',
                },
                {
                    type: 'input_dummy',
                },
            ],
            args1: [
                {
                    type: 'input_statement',
                    name: 'AFTERPURCHASE_STACK',
                    check: 'TradeAgain',
                },
            ],
            args2: [
                {
                    type: 'field_image',
                    src: ' ', // this is here to add extra padding
                    width: 380,
                    height: 10,
                },
            ],
            colour: window.Blockly.Colours.RootBlock.colour,
            colourSecondary: window.Blockly.Colours.RootBlock.colourSecondary,
            colourTertiary: window.Blockly.Colours.RootBlock.colourTertiary,
            tooltip: localize('Get the last trade information and result, then trade again.'),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Restart trading conditions'),
            description: localize('Here is where you can decide if your bot should continue trading.'),
        };
    },
    onchange(event) {
        if (
            event.type === window.Blockly.Events.BLOCK_CHANGE ||
            (event.type === window.Blockly.Events.BLOCK_DRAG && !event.isStart)
        ) {
            if (this.isCollapsed()) {
                appendCollapsedMainBlocksFields(this);
            }
        }
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.after_purchase = block => {
    const stack = window.Blockly.JavaScript.javascriptGenerator.statementToCode(block, 'AFTERPURCHASE_STACK');
    // King Fisher templates deliberately keep scanning after every settlement.
    // Their risk variables are still updated by the workspace blocks, but a
    // TP/SL branch must not end the interpreter after the first contract.
    const workspaceBlocks = block.workspace?.getAllBlocks?.()
        ?? window.Blockly.derivWorkspace?.getAllBlocks?.()
        ?? [];
    const isKingFisher = workspaceBlocks.some(candidate =>
        String(candidate.type || '').startsWith('king_fisher_')
    );
    const hasKingFisherRestartGuard = workspaceBlocks.some(candidate =>
        candidate.type === 'king_fisher_restart_trade'
    );
    const variableName = variableNameText => {
        const variable = block.workspace?.getVariableMap?.()
            ?.getVariables?.()
            ?.find(candidate => candidate.name === variableNameText);
        return variable
            ? window.Blockly.JavaScript.variableDB_.getName(
                variable.getId(),
                window.Blockly.Variables.CATEGORY_NAME
            )
            : null;
    };
    const tradeOptionsBlock = workspaceBlocks.find(
        candidate => candidate.type === 'trade_definition_tradeoptions'
    );
    const predictionBlock = tradeOptionsBlock?.getInputTargetBlock?.('PREDICTION');
    const contractBarrier = Number(predictionBlock?.getFieldValue?.('NUM'));
    const isRecoveryStakeBot = isKingFisher && (contractBarrier === 2 || contractBarrier === 7);
    const stakeVariable = variableName('stake');
    const baseStakeVariable = variableName('base stake');
    const recoveryStateDeclaration = isRecoveryStakeBot && stakeVariable && baseStakeVariable
        ? 'var kingFisherRecoveryStake = 0; var kingFisherRecoveryRunsRemaining = 0;'
        : '';
    const recoveryStakeCode = isRecoveryStakeBot && stakeVariable && baseStakeVariable
        ? `
        // Over 2 and Under 7 keep the recovered martingale stake for three
        // runs after the recovery trade wins. A new loss starts a new recovery.
        if (Bot.isResult("win")) {
            if (kingFisherRecoveryStake > 0) {
                if (kingFisherRecoveryRunsRemaining === 0) {
                    ${stakeVariable} = kingFisherRecoveryStake;
                    kingFisherRecoveryRunsRemaining = 3;
                } else {
                    kingFisherRecoveryRunsRemaining -= 1;
                    if (kingFisherRecoveryRunsRemaining === 0) {
                        kingFisherRecoveryStake = 0;
                        ${stakeVariable} = ${baseStakeVariable};
                    } else {
                        ${stakeVariable} = kingFisherRecoveryStake;
                    }
                }
            } else {
                ${stakeVariable} = ${baseStakeVariable};
            }
        } else {
            kingFisherRecoveryStake = Number(${stakeVariable}) > 0
                ? Number(${stakeVariable})
                : Number(${baseStakeVariable});
            kingFisherRecoveryRunsRemaining = 0;
        }`
        : '';
    let riskGuard = '';
    if (isKingFisher && !hasKingFisherRestartGuard) {
        const takeProfitBlock = workspaceBlocks.find(
            candidate => candidate.type === 'variables_get' && candidate.getFieldValue?.('VAR') === 'take profit'
        );
        const stopLossBlock = workspaceBlocks.find(
            candidate => candidate.type === 'variables_get' && candidate.getFieldValue?.('VAR') === 'stop loss'
        );
        const takeProfit = takeProfitBlock
            ? window.Blockly.JavaScript.javascriptGenerator.forBlock.variables_get(takeProfitBlock)[0]
            : '0';
        const stopLoss = stopLossBlock
            ? window.Blockly.JavaScript.javascriptGenerator.forBlock.variables_get(stopLossBlock)[0]
            : '0';
        riskGuard = `
        if (Number(${takeProfit}) > 0 && Bot.getTotalProfit(false) >= Number(${takeProfit})) {
            if (typeof Bot.emitJournalSignal === "function") Bot.emitJournalSignal({ type: "WIN", label: "TAKE PROFIT HIT", detail: "Keep trading with the best — TP reached" });
            if (typeof Bot.requestKingFisherRescan === "function") Bot.requestKingFisherRescan({ reason: "take-profit", profit: Bot.getTotalProfit(false) });
            return false;
        }
        if (Number(${stopLoss}) > 0 && Bot.getTotalProfit(false) <= -Number(${stopLoss})) {
            if (typeof Bot.emitJournalSignal === "function") Bot.emitJournalSignal({ type: "LOSS", label: "STOP LOSS HIT", detail: "Trading stopped at the configured limit" });
            if (typeof Bot.requestKingFisherRescan === "function") Bot.requestKingFisherRescan({ reason: "stop-loss", profit: Bot.getTotalProfit(false) });
            return false;
        }`;
    }
    const continuation = isKingFisher
        ? 'if (typeof Bot.shouldRescanKingFisher === "function" && Bot.shouldRescanKingFisher()) return false; Bot.isTradeAgain(true); return true;'
        : 'Bot.isTradeAgain(false); return false;';
    const code = `${recoveryStateDeclaration}
    BinaryBotPrivateAfterPurchase = function BinaryBotPrivateAfterPurchase() {
        Bot.highlightBlock('${block.id}');
        ${stack}
        ${riskGuard}
        ${recoveryStakeCode}
        ${continuation}
    };`;
    return code;
};
