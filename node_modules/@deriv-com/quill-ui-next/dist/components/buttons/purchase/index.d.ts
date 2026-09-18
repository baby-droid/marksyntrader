import { FunctionComponent, MouseEvent } from 'react';
export type PurchaseButtonType = {
    className?: string;
    label?: string;
    title?: string;
    value?: string;
    showContent?: boolean;
    /** Variant props */
    state?: "default" | "loading" | "disabled";
    type?: "buy" | "sell";
    /** Event handlers */
    onClick?: (event: MouseEvent<HTMLDivElement>) => void;
};
export declare const PurchaseButton: FunctionComponent<PurchaseButtonType>;
export default PurchaseButton;
