import type {
    AutoSignalAction,
    AutoSignalCandidate,
    AutoSignalMarket,
    AutoSignalsSettings,
} from './types';

const BLOCKLY_XML_NS = 'https://developers.google.com/blockly/xml';
const RUN_COUNT_VARIABLE = 'AUTO_SIGNAL_RUN_COUNT';
export const AUTO_SIGNAL_DURATION_TICKS = 1;
let generatedId = 0;
const boundedInteger = (value: number, minimum: number, maximum: number) =>
    Math.max(minimum, Math.min(maximum, Math.floor(value)));

export const AUTO_SIGNAL_BOTS: Record<AutoSignalAction, { name: string; file: string }> = {
    'trade-only': {
        name: 'Ahmed SYN Even/Odd Market Killer v1.2',
        file: '/bots/ahmed-syn-even-odd.xml',
    },
    'entry-trade': {
        name: 'Speed Bot With Entry v2.2',
        file: '/bots/speed-bot-v2.2.xml',
    },
};

export interface AutoSignalBotConfiguration {
    action: AutoSignalAction;
    market: AutoSignalMarket;
    candidate: AutoSignalCandidate;
    settings: AutoSignalsSettings;
    accountAmounts: {
        stake1: number;
        stake2: number;
        takeProfit: number;
        stopLoss: number;
    };
}

const nextId = () => `as_${Date.now().toString(36)}_${(++generatedId).toString(36)}`;
const localName = (node: Element) => node.localName || node.tagName.split(':').pop() || node.tagName;
const directElements = (node: Element, name?: string) =>
    Array.from(node.children).filter((child) => !name || localName(child) === name);
const directElement = (node: Element, name: string, attributeName?: string, attributeValue?: string) =>
    directElements(node, name).find((child) =>
        attributeName == null || child.getAttribute(attributeName) === attributeValue
    ) ?? null;
const allElements = (root: Document, name: string) =>
    Array.from(root.getElementsByTagNameNS(BLOCKLY_XML_NS, name));
const blocksOfType = (root: Document, type: string) =>
    allElements(root, 'block').filter((block) => block.getAttribute('type') === type);
const directField = (block: Element, name: string) =>
    directElement(block, 'field', 'name', name);

const makeElement = (doc: Document, name: string) => doc.createElementNS(BLOCKLY_XML_NS, name);

const addField = (doc: Document, block: Element, name: string, value: string, variableId?: string) => {
    const field = makeElement(doc, 'field');
    field.setAttribute('name', name);
    if (variableId) field.setAttribute('id', variableId);
    field.textContent = value;
    block.appendChild(field);
    return field;
};

const makeBlock = (doc: Document, type: string) => {
    const block = makeElement(doc, 'block');
    block.setAttribute('type', type);
    block.setAttribute('id', nextId());
    return block;
};

const makeNumberBlock = (doc: Document, value: number, type = 'math_number') => {
    const block = makeBlock(doc, type);
    addField(doc, block, 'NUM', String(value));
    return block;
};

const makeVariableBlock = (doc: Document, type: 'variables_get' | 'variables_set', id: string) => {
    const block = makeBlock(doc, type);
    addField(doc, block, 'VAR', RUN_COUNT_VARIABLE, id);
    return block;
};

const appendValue = (doc: Document, block: Element, name: string, child: Element) => {
    const value = makeElement(doc, 'value');
    value.setAttribute('name', name);
    value.appendChild(child);
    block.appendChild(value);
    return value;
};

const appendNext = (doc: Document, block: Element, child: Element) => {
    const next = makeElement(doc, 'next');
    next.appendChild(child);
    block.appendChild(next);
    return next;
};

const findNumberFields = (root: Element): Element[] =>
    directElements(root).flatMap((child) => {
        if (localName(child) === 'field' && child.getAttribute('name') === 'NUM') return [child];
        return findNumberFields(child);
    });

const setNumberInput = (block: Element, inputName: string, number: number) => {
    const input = directElement(block, 'value', 'name', inputName);
    if (!input) return false;
    const field = findNumberFields(input)[0];
    if (!field) return false;
    field.textContent = String(number);
    return true;
};

const setFieldValue = (block: Element, fieldName: string, value: string, required = true) => {
    let field = directField(block, fieldName);
    if (!field) {
        if (required) throw new Error(`Bot XML is missing the ${fieldName} field.`);
        field = makeElement(block.ownerDocument!, 'field');
        field.setAttribute('name', fieldName);
        block.appendChild(field);
    }
    field.textContent = value;
};

const setVariableValue = (root: Document, variableName: string, value: number) => {
    const setters = blocksOfType(root, 'variables_set').filter((block) =>
        directField(block, 'VAR')?.textContent?.trim().toLowerCase() === variableName.trim().toLowerCase()
    );
    for (const setter of setters) setNumberInput(setter, 'VALUE', value);
};

const findVariableId = (root: Document, variableName: string) =>
    Array.from(root.getElementsByTagNameNS(BLOCKLY_XML_NS, 'variable'))
        .find((variable) => variable.textContent?.trim() === variableName)
        ?.getAttribute('id') ?? null;

const makeRunCounterVariable = (doc: Document) => {
    const variables = directElement(doc.documentElement, 'variables');
    if (!variables) throw new Error('Bot XML has no variables section.');
    const existingId = findVariableId(doc, RUN_COUNT_VARIABLE);
    if (existingId) return existingId;
    const id = nextId();
    const variable = makeElement(doc, 'variable');
    variable.setAttribute('id', id);
    variable.textContent = RUN_COUNT_VARIABLE;
    variables.appendChild(variable);
    return id;
};

const prependStatementBlock = (doc: Document, statement: Element, first: Element) => {
    const previous = directElement(statement, 'block');
    if (previous) {
        statement.removeChild(previous);
        appendNext(doc, first, previous);
    }
    statement.appendChild(first);
};

const lastInNextChain = (block: Element) => {
    let current = block;
    while (true) {
        const next = directElement(current, 'next');
        const nextBlock = next && directElement(next, 'block');
        if (!nextBlock) return current;
        current = nextBlock;
    }
};

const makeRunCounterIncrement = (doc: Document, variableId: string) => {
    const setter = makeVariableBlock(doc, 'variables_set', variableId);
    const addition = makeBlock(doc, 'math_arithmetic');
    addField(doc, addition, 'OP', 'ADD');
    appendValue(doc, addition, 'A', makeVariableBlock(doc, 'variables_get', variableId));
    const one = makeElement(doc, 'shadow');
    one.setAttribute('type', 'math_number');
    one.setAttribute('id', nextId());
    addField(doc, one, 'NUM', '1');
    appendValue(doc, addition, 'B', one);
    appendValue(doc, setter, 'VALUE', addition);
    return setter;
};

const makeCappedTradeAgain = (doc: Document, variableId: string, maxRuns: number) => {
    const conditional = makeBlock(doc, 'controls_if');
    const comparison = makeBlock(doc, 'logic_compare');
    addField(doc, comparison, 'OP', 'LT');
    appendValue(doc, comparison, 'A', makeVariableBlock(doc, 'variables_get', variableId));
    appendValue(doc, comparison, 'B', makeNumberBlock(doc, maxRuns));
    appendValue(doc, conditional, 'IF0', comparison);
    const doInput = makeElement(doc, 'statement');
    doInput.setAttribute('name', 'DO0');
    doInput.appendChild(makeBlock(doc, 'trade_again'));
    conditional.appendChild(doInput);
    return conditional;
};

const addRunLimit = (doc: Document, maxRuns: number) => {
    const tradeDefinition = blocksOfType(doc, 'trade_definition')[0];
    if (!tradeDefinition) throw new Error('Bot XML has no trade parameters block.');
    const variableId = makeRunCounterVariable(doc);
    let initialization = directElement(tradeDefinition, 'statement', 'name', 'INITIALIZATION');
    if (!initialization) {
        initialization = makeElement(doc, 'statement');
        initialization.setAttribute('name', 'INITIALIZATION');
        const submarket = directElement(tradeDefinition, 'statement', 'name', 'SUBMARKET');
        if (submarket) tradeDefinition.insertBefore(initialization, submarket);
        else tradeDefinition.appendChild(initialization);
    }
    const initialize = makeVariableBlock(doc, 'variables_set', variableId);
    appendValue(doc, initialize, 'VALUE', makeNumberBlock(doc, 0));
    prependStatementBlock(doc, initialization, initialize);

    const afterPurchaseStatements = allElements(doc, 'statement')
        .filter((statement) => statement.getAttribute('name') === 'AFTERPURCHASE_STACK');
    const activeStatements = afterPurchaseStatements.filter((statement) => directElement(statement, 'block'));
    if (!activeStatements.length) throw new Error('Bot XML has no after-purchase logic.');

    for (const statement of activeStatements) {
        const first = directElement(statement, 'block');
        if (first) prependStatementBlock(doc, statement, makeRunCounterIncrement(doc, variableId));
        const tradeAgainBlocks = Array.from(statement.getElementsByTagNameNS(BLOCKLY_XML_NS, 'block'))
            .filter((block) => block.getAttribute('type') === 'trade_again');
        for (const tradeAgain of tradeAgainBlocks) {
            const parent = tradeAgain.parentElement;
            if (!parent) continue;
            const continuation = directElement(tradeAgain, 'next');
            const capped = makeCappedTradeAgain(doc, variableId, maxRuns);
            if (continuation) {
                tradeAgain.removeChild(continuation);
                const last = lastInNextChain(directElement(capped, 'statement', 'name', 'DO0')!.firstElementChild!);
                const lastNext = directElement(last, 'next');
                if (lastNext) lastNext.appendChild(continuation.firstElementChild!);
                else last.appendChild(continuation);
            }
            parent.replaceChild(capped, tradeAgain);
            const cappedTradeAgain = directElement(
                directElement(capped, 'statement', 'name', 'DO0')!,
                'block',
            );
            if (cappedTradeAgain) {
                const originalFields = directElements(tradeAgain, 'field');
                originalFields.forEach((field) => cappedTradeAgain.appendChild(field.cloneNode(true)));
            }
        }
        if (!tradeAgainBlocks.length) throw new Error('Bot XML has no trade-again block to cap.');
    }
};

const unwrapTimeouts = (container: Element) => {
    for (const block of directElements(container, 'block')) {
        for (const child of directElements(block)) {
            if (['statement', 'value', 'next'].includes(localName(child))) unwrapTimeouts(child);
        }
        if (block.getAttribute('type') !== 'timeout') continue;

        const parent = block.parentElement;
        const body = directElement(block, 'statement', 'name', 'TIMEOUTSTACK');
        const inner = body && directElement(body, 'block');
        if (!parent) continue;
        const next = directElement(block, 'next');
        if (!inner) {
            if (next) parent.replaceChild(next, block);
            else parent.removeChild(block);
            continue;
        }
        if (next) {
            block.removeChild(next);
            const last = lastInNextChain(inner);
            const lastNext = directElement(last, 'next');
            if (lastNext) lastNext.appendChild(next.firstElementChild!);
            else last.appendChild(next);
        }
        parent.replaceChild(inner, block);
    }
};

const setContractType = (doc: Document, candidate: AutoSignalCandidate) => {
    const category = candidate.contractType === 'CALL' || candidate.contractType === 'PUT'
        ? 'callput'
        : 'digits';
    const tradeType = candidate.contractType === 'CALL' || candidate.contractType === 'PUT'
        ? 'risefall'
        : candidate.contractType === 'DIGITEVEN' || candidate.contractType === 'DIGITODD'
            ? 'evenodd'
            : candidate.contractType === 'DIGITOVER' || candidate.contractType === 'DIGITUNDER'
                ? 'overunder'
                : candidate.contractType === 'DIGITMATCH' || candidate.contractType === 'DIGITDIFF'
                    ? 'matchesdiffers'
                    : 'runs';
    const tradeTypeBlock = blocksOfType(doc, 'trade_definition_tradetype')[0];
    const contractTypeBlock = blocksOfType(doc, 'trade_definition_contracttype')[0];
    const purchaseBlock = blocksOfType(doc, 'purchase')[0];
    if (!tradeTypeBlock || !contractTypeBlock || !purchaseBlock) {
        throw new Error('Bot XML is missing a trade type or purchase block.');
    }
    setFieldValue(tradeTypeBlock, 'TRADETYPECAT_LIST', category);
    setFieldValue(tradeTypeBlock, 'TRADETYPE_LIST', tradeType);
    setFieldValue(contractTypeBlock, 'TYPE_LIST', candidate.contractType);
    setFieldValue(purchaseBlock, 'PURCHASE_LIST', candidate.contractType);
};

const configureTradeParameters = (
    doc: Document,
    config: AutoSignalBotConfiguration,
) => {
    const marketBlock = blocksOfType(doc, 'trade_definition_market')[0];
    const optionsBlock = blocksOfType(doc, 'trade_definition_tradeoptions')[0];
    if (!marketBlock || !optionsBlock) throw new Error('Bot XML is missing market or duration settings.');

    setFieldValue(marketBlock, 'MARKET_LIST', config.market.market);
    setFieldValue(marketBlock, 'SUBMARKET_LIST', config.market.submarket);
    setFieldValue(marketBlock, 'SYMBOL_LIST', config.market.symbol);
    setFieldValue(marketBlock, 'ALTERNATE_MARKETS', 'FALSE', false);
    setContractType(doc, config.candidate);

    setFieldValue(optionsBlock, 'DURATIONTYPE_LIST', 't');
    if (!setNumberInput(optionsBlock, 'DURATION', AUTO_SIGNAL_DURATION_TICKS)) {
        throw new Error('Bot XML is missing its tick-duration input.');
    }
    setNumberInput(optionsBlock, 'AMOUNT', config.accountAmounts.stake1);

    const needsPrediction = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF']
        .includes(config.candidate.contractType);
    const mutation = directElement(optionsBlock, 'mutation');
    if (mutation) mutation.setAttribute('has_prediction', String(needsPrediction));
    let prediction = directElement(optionsBlock, 'value', 'name', 'PREDICTION');
    if (needsPrediction) {
        if (!prediction) {
            prediction = makeElement(doc, 'value');
            prediction.setAttribute('name', 'PREDICTION');
            const shadow = makeElement(doc, 'shadow');
            shadow.setAttribute('type', 'math_number_positive');
            shadow.setAttribute('id', nextId());
            addField(doc, shadow, 'NUM', String(config.candidate.barrier ?? 0));
            prediction.appendChild(shadow);
            optionsBlock.appendChild(prediction);
        } else {
            setNumberInput(optionsBlock, 'PREDICTION', config.candidate.barrier ?? 0);
        }
    } else if (prediction) {
        optionsBlock.removeChild(prediction);
    }

    if (config.action === 'trade-only') {
        setVariableValue(doc, 'stake', config.accountAmounts.stake1);
        setVariableValue(doc, 'initial stake', config.accountAmounts.stake1);
        setVariableValue(doc, 'totalprofit', config.accountAmounts.takeProfit);
        setVariableValue(doc, 'totalloss', config.accountAmounts.stopLoss);
        setVariableValue(doc, 'martingale', config.settings.martingale);
    } else {
        setVariableValue(doc, 'STAKE', config.accountAmounts.stake1);
        setVariableValue(doc, 'stake2', config.accountAmounts.stake2);
        setVariableValue(doc, 'takeprofit', config.accountAmounts.takeProfit);
        setVariableValue(doc, 'stoploss', config.accountAmounts.stopLoss);
        setVariableValue(doc, 'martingalelevel', config.settings.martingale);
        setVariableValue(doc, 'entrypoint1', config.candidate.entryDigit ?? config.market.latestDigit ?? 0);
        setVariableValue(doc, 'prediction digit', config.candidate.barrier ?? config.candidate.entryDigit ?? 0);
    }
};

export const patchAutoSignalsBotXml = (xml: string, config: AutoSignalBotConfiguration) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('The selected bot XML could not be parsed.');
    if (doc.documentElement.namespaceURI !== BLOCKLY_XML_NS) {
        throw new Error('The selected bot XML is not a Blockly workspace.');
    }

    configureTradeParameters(doc, config);
    const beforePurchase = blocksOfType(doc, 'before_purchase')[0];
    const beforePurchaseStack = beforePurchase
        ? directElement(beforePurchase, 'statement', 'name', 'BEFOREPURCHASE_STACK')
        : null;
    if (beforePurchaseStack) unwrapTimeouts(beforePurchaseStack);
    addRunLimit(doc, boundedInteger(config.settings.maxRuns, 1, 10));

    return new XMLSerializer().serializeToString(doc);
};

