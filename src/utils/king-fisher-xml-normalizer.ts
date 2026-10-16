const BLOCKLY_XML_NAMESPACE = 'https://developers.google.com/blockly/xml';

const directChildren = (element: Element | null | undefined, name: string) =>
    Array.from(element?.children ?? []).filter(child => child.localName === name);

const getDirectBlock = (element: Element | null | undefined) =>
    directChildren(element, 'block')[0] ?? null;

const getField = (block: Element, name: string) =>
    directChildren(block, 'field').find(field => field.getAttribute('name') === name) ?? null;

const normalizeVariableName = (value: string | null | undefined) =>
    String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');

const createXmlElement = (document: XMLDocument, name: string) =>
    document.createElementNS(document.documentElement.namespaceURI || BLOCKLY_XML_NAMESPACE, name);

const setFirstBlock = (container: Element, block: Element) => {
    const oldBlock = getDirectBlock(container);
    if (oldBlock) container.replaceChild(block, oldBlock);
    else container.appendChild(block);
};

const appendBlockToChain = (head: Element, block: Element, document: XMLDocument) => {
    let current = head;
    while (true) {
        let next = directChildren(current, 'next')[0];
        if (!next) {
            next = createXmlElement(document, 'next');
            current.appendChild(next);
        }
        const nextBlock = getDirectBlock(next);
        if (!nextBlock) {
            next.appendChild(block);
            return;
        }
        current = nextBlock;
    }
};

const createVariableGetter = (
    document: XMLDocument,
    id: string,
    variableId: string,
    variableName: string,
) => {
    const value = createXmlElement(document, 'value');
    value.setAttribute('name', id.endsWith('_tp') ? 'TAKE_PROFIT' : 'STOP_LOSS');
    const getter = createXmlElement(document, 'block');
    getter.setAttribute('type', 'variables_get');
    getter.setAttribute('id', id);
    const field = createXmlElement(document, 'field');
    field.setAttribute('name', 'VAR');
    field.setAttribute('id', variableId);
    field.textContent = variableName;
    getter.appendChild(field);
    value.appendChild(getter);
    return value;
};

/**
 * Keep the bundled King Fisher strategies intact while correcting their
 * trade-parameter stack and ensuring the shared TP/SL/martingale guard runs
 * before each bot's existing post-purchase blocks.
 */
export const normalizeKingFisherXml = (source: string): string => {
    const document = new DOMParser().parseFromString(source, 'application/xml');
    const root = document.documentElement;
    if (
        document.getElementsByTagName('parsererror').length ||
        root?.localName !== 'xml'
    ) {
        throw new Error('The King Fisher file is not valid Blockly XML.');
    }

    const blocks = Array.from(document.getElementsByTagNameNS(BLOCKLY_XML_NAMESPACE, 'block'));
    if (!blocks.length) {
        throw new Error('The King Fisher file has no executable Blockly blocks.');
    }
    if (!blocks.some(block => String(block.getAttribute('type')).startsWith('king_fisher_'))) {
        return source;
    }

    const rootBlocks = directChildren(root, 'block');
    const tradeDefinition = rootBlocks.find(block => block.getAttribute('type') === 'trade_definition');
    const tradeOptions = directChildren(tradeDefinition, 'statement')
        .find(statement => statement.getAttribute('name') === 'TRADE_OPTIONS');
    const scanner = blocks.find(block => block.getAttribute('type') === 'king_fisher_best_market_scanner');
    const market = directChildren(tradeOptions, 'block')
        .find(block => block.getAttribute('type') === 'trade_definition_market');

    if (scanner && tradeOptions && market) {
        const firstTradeOption = getDirectBlock(tradeOptions);
        if (firstTradeOption !== scanner) {
            if (scanner.parentElement?.localName === 'next') {
                scanner.parentElement.removeChild(scanner);
            } else if (scanner.parentElement === root) {
                root.removeChild(scanner);
            }

            // Preserve the original market block and its connected chain while
            // placing the selector immediately above it.
            appendBlockToChain(scanner, firstTradeOption, document);
            setFirstBlock(tradeOptions, scanner);
        }
    }

    const afterPurchase = rootBlocks.find(block => block.getAttribute('type') === 'after_purchase');
    const afterPurchaseStack = directChildren(afterPurchase, 'statement')
        .find(statement => statement.getAttribute('name') === 'AFTERPURCHASE_STACK');
    const hasRestartGuard = blocks.some(block => block.getAttribute('type') === 'king_fisher_restart_trade');

    if (afterPurchaseStack && !hasRestartGuard) {
        const variables = Array.from(document.getElementsByTagNameNS(BLOCKLY_XML_NAMESPACE, 'variable'));
        const takeProfit = variables.find(variable => normalizeVariableName(variable.textContent) === 'take profit');
        const stopLoss = variables.find(variable => normalizeVariableName(variable.textContent) === 'stop loss');

        if (takeProfit?.getAttribute('id') && stopLoss?.getAttribute('id')) {
            const existingIds = new Set(blocks.map(block => block.getAttribute('id')).filter(Boolean));
            const prefix = (takeProfit.getAttribute('id') || 'king_fisher').split('_')[0];
            const uniqueId = (suffix: string) => {
                const base = `${prefix}_restart_${suffix}`;
                let id = base;
                let index = 1;
                while (existingIds.has(id)) id = `${base}_${index++}`;
                existingIds.add(id);
                return id;
            };
            const restart = createXmlElement(document, 'block');
            restart.setAttribute('type', 'king_fisher_restart_trade');
            restart.setAttribute('id', uniqueId('guard'));
            restart.appendChild(createVariableGetter(
                document,
                uniqueId('tp'),
                takeProfit.getAttribute('id')!,
                takeProfit.textContent || 'take profit',
            ));
            restart.appendChild(createVariableGetter(
                document,
                uniqueId('sl'),
                stopLoss.getAttribute('id')!,
                stopLoss.textContent || 'stop loss',
            ));
            const multiplier = createXmlElement(document, 'field');
            multiplier.setAttribute('name', 'MULTIPLIER');
            multiplier.textContent = '2';
            restart.appendChild(multiplier);

            const existingStack = getDirectBlock(afterPurchaseStack);
            if (existingStack) {
                const next = createXmlElement(document, 'next');
                next.appendChild(existingStack);
                restart.appendChild(next);
            }
            setFirstBlock(afterPurchaseStack, restart);
        }
    }

    return new XMLSerializer().serializeToString(document);
};
