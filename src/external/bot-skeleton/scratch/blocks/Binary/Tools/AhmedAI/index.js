import { localize } from '@deriv-com/translations';

window.Blockly.Blocks.ahmed_ai_signal = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: '🤖 AHMED AI Signal %1',
            args0: [{ type: 'input_dummy' }],
            output: 'String',
            colour: '#7c3aed',
            tooltip: localize('Returns the AHMED AI market signal: OVER, UNDER, EVEN, ODD, or SKIP.'),
            helpUrl: '',
        };
    },
    meta() {
        return {
            display_name: localize('AHMED AI Signal'),
            description: localize('Returns the current AI market signal based on digit analysis.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.ahmed_ai_signal = () => {
    const code = `(function(){
        try {
            var ticks = Bot.getLastTicks(20);
            if (!ticks || ticks.length < 5) return 'SKIP';
            var digits = ticks.map(function(t){ return Math.round((t % 1) * 10); });
            var counts = new Array(10).fill(0);
            digits.forEach(function(d){ counts[d]++; });
            var even = digits.filter(function(d){ return d % 2 === 0; }).length;
            var total = digits.length;
            var evenPct = even / total;
            var maxD = counts.indexOf(Math.max.apply(null, counts));
            var minD = counts.indexOf(Math.min.apply(null, counts));
            if (minD <= 1) return 'OVER';
            if (minD >= 8) return 'UNDER';
            if (evenPct > 0.6) return 'EVEN';
            if (evenPct < 0.4) return 'ODD';
            return 'SKIP';
        } catch(e) { return 'SKIP'; }
    }())`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_FUNCTION_CALL];
};

window.Blockly.Blocks.ahmed_ai_notify = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: '🤖 AHMED AI Notify %1',
            args0: [{
                type: 'input_value',
                name: 'MESSAGE',
                check: 'String',
            }],
            previousStatement: null,
            nextStatement: null,
            colour: '#7c3aed',
            tooltip: localize('Show an AHMED AI notification in the bot.'),
            helpUrl: '',
        };
    },
    meta() {
        return {
            display_name: localize('AHMED AI Notify'),
            description: localize('Display a notification from the AHMED AI system.'),
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.ahmed_ai_notify = block => {
    const msg = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block, 'MESSAGE', window.Blockly.JavaScript.javascriptGenerator.ORDER_NONE
    ) || '"AHMED AI"';
    return `Bot.highlightBlock('${block.id}');\ntry { console.log('[AHMED AI]', ${msg}); } catch(e){}\n`;
};
