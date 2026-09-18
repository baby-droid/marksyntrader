import { FunctionComponent, ReactNode, PropsWithChildren } from 'react';
export type AccordionType = {
    className?: string;
    title?: string;
    subtitle?: string;
    customIcon?: ReactNode;
    showFocusRing?: boolean;
    /** Variant props */
    expand?: "off" | "on";
    size?: "xs" | "sm" | "md" | "lg";
    state?: "default" | "disabled";
    type?: "outline" | "fill" | "elevate" | "flush";
};
export declare const Accordion: FunctionComponent<PropsWithChildren<AccordionType>>;
export default Accordion;
