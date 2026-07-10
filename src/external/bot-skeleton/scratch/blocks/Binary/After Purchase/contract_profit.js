import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.contract_profit = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Profit from last trade'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('This block returns the profit/loss amount of the last completed trade.'),
            category: window.Blockly.Categories.After_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Profit from last trade'),
            description: localize('You can read the profit or loss amount of your last trade with this block.'),
        };
    },
    onchange(event) {
        if (!this.workspace || window.Blockly.derivWorkspace.isFlyoutVisible || this.workspace.isDragging()) {
            return;
        }

        if (
            event.type === window.Blockly.Events.BLOCK_CREATE ||
            (event.type === window.Blockly.Events.BLOCK_DRAG && !event.isStart)
        ) {
            const top_parent = this.getTopParent();

            if (top_parent) {
                const is_illegal_root_block = top_parent.isMainBlock() && top_parent.type !== 'after_purchase';

                if (is_illegal_root_block) {
                    this.setDisabled(true);
                }
            }
        }
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    restricted_parents: ['after_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.contract_profit = () => {
    const code = 'Bot.readDetails(4)';
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
