import { FunctionComponent, ReactNode } from 'react';
export type BasicButtonType = {
    className?: string;
    label?: string;
    /** Variant props */
    size?: "lg" | "xl" | "md" | "sm";
    state?: "default" | "loading" | "disabled";
    style?: "primary" | "secondary" | "tertiary";
    width?: "hug content" | "fill container";
    color?: "coral" | "black" | "white" | "blackWhite" | "whiteBlack" | "buy" | "sell" | "glacier";
    /** Custom Props  */
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};
export declare const BasicButton: FunctionComponent<BasicButtonType>;
export default BasicButton;
