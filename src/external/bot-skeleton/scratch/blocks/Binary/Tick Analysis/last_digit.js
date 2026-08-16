import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.last_digit = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Last Digit'),
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Returns the last digit of the latest tick'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Last Digit'),
            description: localize('This block gives you the last digit of the latest tick value.'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.last_digit = () => [
    'Bot.getLastDigit()',
    window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC,
];

// Shared entry primitive for the recovery bots. It deliberately lives in the
// Bot Builder block set so imported XML remains executable rather than relying
// on a page-specific scanner.
window.Blockly.Blocks.ahmed_repeated_digit = {
    init() {
        this.jsonInit({
            message0: localize('Repeated digit pattern'),
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('True after the same last digit appears three times in succession.'),
            category: window.Blockly.Categories.Tick_Analysis,
        });
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.ahmed_repeated_digit = () => {
    const generator = window.Blockly.JavaScript.javascriptGenerator;
    const functionName = generator.provideFunction_('ahmedRepeatedDigit', [
        `var ahmedRepeatedPrevious = null;
         var ahmedRepeatedCount = 0;
         function ${generator.FUNCTION_NAME_PLACEHOLDER_}() {
             var digit = Bot.getLastDigit();
             if (digit === ahmedRepeatedPrevious) ahmedRepeatedCount += 1;
             else { ahmedRepeatedPrevious = digit; ahmedRepeatedCount = 1; }
             return ahmedRepeatedCount >= 3;
         }`,
    ]);
    return [`${functionName}()`, generator.ORDER_FUNCTION_CALL];
};
