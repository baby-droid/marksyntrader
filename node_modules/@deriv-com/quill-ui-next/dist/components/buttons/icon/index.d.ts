import { FunctionComponent, ReactNode } from 'react';
export type IconButtonType = {
    /** Variant props */
    size?: "lg" | "xl" | "md" | "sm";
    state?: "default" | "loading" | "disabled";
    style?: "primary" | "tertiary";
    width?: "hug content" | "fill container";
    /** Custom Props  */
    className?: string;
    color?: "coral" | "black" | "white" | "blackWhite" | "whiteBlack";
    icon: ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};
export declare const IconButton: FunctionComponent<IconButtonType>;
export default IconButton;
