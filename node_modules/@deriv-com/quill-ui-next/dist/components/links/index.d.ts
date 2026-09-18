import { FunctionComponent, ReactNode } from 'react';
export type LinkType = {
    className?: string;
    label?: string;
    showChevron?: boolean;
    /** Variant props */
    size?: "caption" | "sm" | "md" | "lg" | "xl";
    state?: "default" | "disabled";
    /** Custom Props  */
    color?: "blackWhite" | "black" | "whiteBlack" | "white";
    icon?: ReactNode;
    href?: string;
    openNewTab?: boolean;
};
export declare const Link: FunctionComponent<LinkType>;
export default Link;
