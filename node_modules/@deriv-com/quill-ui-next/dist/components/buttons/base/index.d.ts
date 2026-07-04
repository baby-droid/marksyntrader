import { FunctionComponent, ReactNode } from 'react';
export type BaseButtonType = {
    className?: string;
    label?: string;
    hasIconLeft?: boolean;
    hasIconRight?: boolean;
    hasLabel?: boolean;
    iconLoading?: boolean;
    showFocusRing?: boolean;
    /** Variant props */
    size?: "lg" | "xl" | "md" | "sm";
    state?: "default" | "loading" | "disabled";
    style?: "primary" | "secondary" | "tertiary";
    width?: "hug content" | "fill container";
    /** Custom Props  */
    color?: "coral" | "black" | "white" | "blackWhite" | "whiteBlack" | "buy" | "sell" | "glacier";
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    icon?: ReactNode;
    type?: "basic" | "icon";
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};
declare const BaseButton: FunctionComponent<BaseButtonType>;
export default BaseButton;
