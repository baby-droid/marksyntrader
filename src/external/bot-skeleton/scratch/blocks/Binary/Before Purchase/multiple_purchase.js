import { localize } from '@deriv-com/translations';
import { excludeOptionFromContextMenu, modifyContextMenu } from '../../../utils';

const CONTRACT_OPTIONS = [
    [localize('None'), ''],
    [localize('Over'), 'DIGITOVER'],
    [localize('Under'), 'DIGITUNDER'],
    [localize('Even'), 'DIGITEVEN'],
    [localize('Odd'), 'DIGITODD'],
    [localize('Matches'), 'DIGITMATCH'],
    [localize('Differs'), 'DIGITDIFF'],
];

window.Blockly.Blocks.multiple_purchase = {
    init() {
        this.jsonInit({
            message0: localize('Multiple Purchase: %1 %2 %3 %4 %5 %6'),
            args0: [1, 2, 3, 4, 5, 6].map(index => ({
                type: 'field_dropdown',
                name: `PURCHASE_${index}`,
                options: CONTRACT_OPTIONS,
            })),
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize(
                'Purchase up to six selected contract types on the same entry tick. The first selected type is the tracked contract; additional types are independent purchases.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        });
        this.setNextStatement(false);
    },
    meta() {
        return {
            display_name: localize('Multiple Purchase'),
            description: localize(
                'Purchase multiple contract types together, including Over, Under, Even, Odd, Matches, and Differs.'
            ),
            key_words: localize('multiple purchase, over, under, even, odd, matches, differs'),
        };
    },
    onchange(event) {
        if (!this.workspace || window.Blockly.derivWorkspace.isFlyoutVisible || this.workspace.isDragging()) return;

        if (event.type === window.Blockly.Events.BLOCK_CREATE && event.ids.includes(this.id)) {
            // Keep the flyout block useful immediately while leaving all other slots empty.
            const first = this.getField('PURCHASE_1');
            if (first && !first.getValue()) first.setValue('DIGITOVER');
        }
    },
    customContextMenu(menu) {
        const menu_items = [localize('Enable Block'), localize('Disable Block')];
        excludeOptionFromContextMenu(menu, menu_items);
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.multiple_purchase = block => {
    const contract_types = [1, 2, 3, 4, 5, 6]
        .map(index => block.getFieldValue(`PURCHASE_${index}`))
        .filter(Boolean);

    if (!contract_types.length) return '';

    return `Bot.purchaseMultiple(${JSON.stringify(contract_types)});\n`;
};