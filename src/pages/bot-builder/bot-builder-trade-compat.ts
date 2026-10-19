type TradeTypeBlock = {
    getFieldValue?: (fieldName: string) => unknown;
};

type TradeDefinitionBlock = {
    getChildByType?: (type: string) => TradeTypeBlock | null | undefined;
    [key: string]: unknown;
};

type GeneratorFunction = (this: unknown, block: unknown, ...args: unknown[]) => unknown;

type BlocklyRuntime = {
    JavaScript?: {
        javascriptGenerator?: {
            forBlock?: Record<string, unknown>;
        };
    };
};

const installedGenerators = new WeakSet<object>();

export const tradeTypeForOppositeLookup = (category: string, tradeType: string): string =>
    category === 'callput' && tradeType === 'risefall' ? 'callput' : tradeType;

/**
 * The vendored trade-definition generator looks up opposites by uppercasing
 * TRADETYPE_LIST. Its Rise/Fall value is "risefall", while the config key is
 * CALLPUT. Present the compatible value only during code generation; leave the
 * Blockly field and saved XML unchanged.
 */
export const installBotBuilderTradeTypeCompatibility = (blockly: BlocklyRuntime | undefined): boolean => {
    const javascriptGenerator = blockly?.JavaScript?.javascriptGenerator;
    const forBlock = javascriptGenerator?.forBlock;
    if (!javascriptGenerator || !forBlock) return false;
    if (installedGenerators.has(javascriptGenerator)) return true;

    const original = forBlock.trade_definition;
    if (typeof original !== 'function') return false;

    const originalGenerator = original as GeneratorFunction;
    forBlock.trade_definition = function (this: unknown, block: unknown, ...args: unknown[]) {
        if (!block || typeof block !== 'object') {
            return originalGenerator.call(this, block, ...args);
        }

        const targetBlock = block as TradeDefinitionBlock;
        const getChildByType = targetBlock.getChildByType;
        if (typeof getChildByType !== 'function') {
            return originalGenerator.call(this, block, ...args);
        }

        const tradeTypeBlock = getChildByType.call(targetBlock, 'trade_definition_tradetype');
        const getFieldValue = tradeTypeBlock?.getFieldValue;
        if (typeof getFieldValue !== 'function') {
            return originalGenerator.call(this, block, ...args);
        }

        const category = getFieldValue.call(tradeTypeBlock, 'TRADETYPECAT_LIST');
        const tradeType = getFieldValue.call(tradeTypeBlock, 'TRADETYPE_LIST');
        if (category !== 'callput' || tradeType !== 'risefall') {
            return originalGenerator.call(this, block, ...args);
        }

        const normalizedTradeType = tradeTypeForOppositeLookup(category, tradeType);
        const compatibleBlock = new Proxy(targetBlock, {
            get(target, property) {
                if (property === 'getChildByType') {
                    return (type: string) => {
                        const child = getChildByType.call(target, type);
                        if (type !== 'trade_definition_tradetype' || !child) return child;

                        return new Proxy(child, {
                            get(fieldBlock, fieldProperty) {
                                if (fieldProperty === 'getFieldValue') {
                                    const fieldGetter = fieldBlock.getFieldValue;
                                    if (typeof fieldGetter !== 'function') return undefined;
                                    return (fieldName: string) => {
                                        if (fieldName === 'TRADETYPE_LIST') return normalizedTradeType;
                                        return fieldGetter.call(fieldBlock, fieldName);
                                    };
                                }

                                const value = Reflect.get(fieldBlock, fieldProperty, fieldBlock);
                                return typeof value === 'function' ? value.bind(fieldBlock) : value;
                            },
                        });
                    };
                }

                const value = Reflect.get(target, property, target);
                return typeof value === 'function' ? value.bind(target) : value;
            },
        });

        return originalGenerator.call(this, compatibleBlock, ...args);
    };

    installedGenerators.add(javascriptGenerator);
    return true;
};
