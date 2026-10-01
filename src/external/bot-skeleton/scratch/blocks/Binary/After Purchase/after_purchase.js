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
    const workspace = block.workspace ?? window.Blockly.derivWorkspace;
    const workspaceBlocks = workspace?.getAllBlocks?.() ?? [];
    const isKingFisher = workspaceBlocks.some(candidate =>
        String(candidate.type || '').startsWith('king_fisher_')
    );
    const shouldRotateContinuousMarkets = workspaceBlocks.some(candidate =>
        candidate.type === 'trade_definition_market' &&
        candidate.getFieldValue?.('ALTERNATE_MARKETS') === 'TRUE'
    );
    const hasKingFisherRestartGuard = workspaceBlocks.some(candidate =>
        candidate.type === 'king_fisher_restart_trade'
    );
    const normalizeVariableName = value => String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ');
    const workspaceVariables = workspace?.getVariableMap?.()?.getVariables?.() ?? [];
    const variableName = variableNameText => {
        const targetName = normalizeVariableName(variableNameText);
        const variable = workspaceVariables.find(candidate => candidate.name === variableNameText)
            || workspaceVariables.find(candidate => normalizeVariableName(candidate.name) === targetName);
        return variable
            ? window.Blockly.JavaScript.variableDB_.getName(
                variable.getId(),
                window.Blockly.Variables.CATEGORY_NAME
            )
            : null;
    };
    const variableCodeForId = variableId => {
        const variable = workspaceVariables.find(candidate => candidate.getId() === variableId);
        return variable
            ? window.Blockly.JavaScript.variableDB_.getName(
                variable.getId(),
                window.Blockly.Variables.CATEGORY_NAME
            )
            : null;
    };
    const recoveryEscalationBlock = workspaceBlocks.find(
        candidate => candidate.type === 'king_fisher_recovery_escalation'
    );
    const variableCodeForField = (block, fieldName) => {
        const field = block.getField?.(fieldName);
        const byId = variableCodeForId(block.getFieldValue(fieldName));
        return byId || variableName(field?.getText?.());
    };
    let recoveryPhaseSnapshot = '';
    let recoveryEscalationCode = '';
    if (recoveryEscalationBlock) {
        const phaseVariable = variableCodeForField(recoveryEscalationBlock, 'PHASE');
        const lossCountVariable = variableCodeForField(recoveryEscalationBlock, 'LOSS_COUNT');
        if (!phaseVariable || !lossCountVariable) {
            const missingFields = [
                ...(!phaseVariable ? [`PHASE (${recoveryEscalationBlock.getFieldValue('PHASE') || recoveryEscalationBlock.getField?.('PHASE')?.getText?.() || 'unset'})`] : []),
                ...(!lossCountVariable ? [`LOSS_COUNT (${recoveryEscalationBlock.getFieldValue('LOSS_COUNT') || recoveryEscalationBlock.getField?.('LOSS_COUNT')?.getText?.() || 'unset'})`] : []),
            ].join(', ');
            recoveryEscalationCode = `if (typeof Bot.emitJournalSignal === "function") Bot.emitJournalSignal({ type: "LOSS", label: "RECOVERY CONFIGURATION ERROR", detail: "Recovery Escalation could not resolve ${missingFields}; no escalation was applied." });`;
        } else {
            const recoveryPhase = Number(recoveryEscalationBlock.getFieldValue('RECOVERY_PHASE'));
            const firstOver3Phase = Number(recoveryEscalationBlock.getFieldValue('FIRST_OVER3_PHASE'));
            const secondOver3Phase = Number(recoveryEscalationBlock.getFieldValue('SECOND_OVER3_PHASE'));
            const configuredReturnPhase = Number(recoveryEscalationBlock.getFieldValue('RETURN_PHASE'));
            const returnPhase = Number.isFinite(configuredReturnPhase) ? configuredReturnPhase : recoveryPhase;
            recoveryPhaseSnapshot = `var kingFisherRecoveryPhaseAtSettlement = Number(${phaseVariable});`;
            recoveryEscalationCode = `
        var kingFisherRecoveryStep = Bot.advanceKingFisherRecoveryEscalation(
            kingFisherRecoveryPhaseAtSettlement,
            Number(${lossCountVariable}),
            Bot.isResult("win"),
            ${recoveryPhase},
            ${firstOver3Phase},
            ${secondOver3Phase},
            ${returnPhase}
        );
        if (kingFisherRecoveryStep.phase !== null) {
            ${phaseVariable} = kingFisherRecoveryStep.phase;
        }
        ${lossCountVariable} = kingFisherRecoveryStep.lossCount;`;
        }
    }
    const tradeOptionsBlock = workspaceBlocks.find(
        candidate => candidate.type === 'trade_definition_tradeoptions'
    );
    const predictionBlock = tradeOptionsBlock?.getInputTargetBlock?.('PREDICTION');
    const contractBarrier = Number(predictionBlock?.getFieldValue?.('NUM'));
    const isRecoveryStakeBot = isKingFisher && (contractBarrier === 2 || contractBarrier === 7);
    const stakeVariable = variableName('stake');
    const baseStakeVariable = variableName('base stake');
    const martingaleVariable = variableName('martingale');
    const recoveryStateDeclaration = isRecoveryStakeBot && stakeVariable && baseStakeVariable
        ? 'var kingFisherRecoveryStake = 0; var kingFisherRecoveryCarryWins = 0;'
        : '';
    const recoveryStakeCode = isRecoveryStakeBot && stakeVariable && baseStakeVariable
        ? `
        // Over 2 and Under 7 keep the recovered martingale stake for three
        // additional trades after the recovery trade wins. A new loss starts
        // a new recovery and replaces the carried stake.
        if (Bot.isResult("win")) {
            if (kingFisherRecoveryStake > 0) {
                if (kingFisherRecoveryCarryWins === 0) {
                    kingFisherRecoveryCarryWins = 3;
                } else {
                    kingFisherRecoveryCarryWins -= 1;
                }
                ${stakeVariable} = kingFisherRecoveryCarryWins > 0
                    ? kingFisherRecoveryStake
                    : ${baseStakeVariable};
                if (kingFisherRecoveryCarryWins === 0) kingFisherRecoveryStake = 0;
            } else {
                ${stakeVariable} = ${baseStakeVariable};
            }
        } else {
            kingFisherRecoveryStake = Number(${stakeVariable}) > 0
                ? Number(${stakeVariable})
                : Number(${baseStakeVariable});
            kingFisherRecoveryCarryWins = 0;
        }`
        : '';
    const kingFisherStakeSnapshot = isKingFisher && stakeVariable
        ? `var kingFisherSettledStake = Number(${stakeVariable});`
        : '';
    const kingFisherStakeHandoff = isKingFisher && stakeVariable && baseStakeVariable && martingaleVariable
        ? `
        /*
         * King Fisher owns the next purchase stake at settlement time. The
         * XML result blocks remain visible/editable in the workspace, while
         * this handoff is the runtime guard that makes a loss always carry
         * the configured multiplier into the following real contract.
         * Over 2 and Under 7 retain their recovery-win carry logic below.
         */
        if (!Bot.isResult("win") && !(${isRecoveryStakeBot ? 'true' : 'false'}) &&
            (!(Number(${stakeVariable}) > Number(kingFisherSettledStake) && Number(kingFisherSettledStake) > 0))) {
            ${stakeVariable} = Number(kingFisherSettledStake) > 0
                ? Number(kingFisherSettledStake) * Number(${martingaleVariable})
                : Number(${baseStakeVariable}) * Number(${martingaleVariable});
        }`
        : '';
    let riskGuard = '';
    if (isKingFisher && !hasKingFisherRestartGuard) {
        const takeProfitBlock = workspaceBlocks.find(
            candidate => candidate.type === 'variables_get'
                && normalizeVariableName(
                    candidate.getField?.('VAR')?.getText?.()
                    || workspaceVariables.find(variable => variable.getId() === candidate.getFieldValue?.('VAR'))?.name
                    || candidate.getFieldValue?.('VAR')
                ) === 'take profit'
        );
        const stopLossBlock = workspaceBlocks.find(
            candidate => candidate.type === 'variables_get'
                && normalizeVariableName(
                    candidate.getField?.('VAR')?.getText?.()
                    || workspaceVariables.find(variable => variable.getId() === candidate.getFieldValue?.('VAR'))?.name
                    || candidate.getFieldValue?.('VAR')
                ) === 'stop loss'
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
        ${recoveryPhaseSnapshot}
        ${kingFisherStakeSnapshot}
        ${stack}
        ${recoveryEscalationCode}
        ${riskGuard}
        ${kingFisherStakeHandoff}
        ${recoveryStakeCode}
        ${shouldRotateContinuousMarkets ? 'Bot.rotateContinuousMarket();' : ''}
        ${continuation}
    };`;
    return code;
};
