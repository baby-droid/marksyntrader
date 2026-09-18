interface StyleResult {
    matchingRules: string[];
    properties: Record<string, string>;
    customVariables: Array<{
        variable: string;
        value: string;
    }>;
}
export declare const getElementCssStyles: (selector: string) => StyleResult | null;
export declare const applySvgFill: (selector: string | undefined, color: string, classNames?: string[]) => void;
export declare const getIdSelector: (id: string, childClass?: string) => string;
export {};
