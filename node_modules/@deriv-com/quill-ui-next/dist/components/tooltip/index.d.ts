import { ReactNode } from 'react';
import { LinkType } from '../links';
import { BasicButtonType } from '../buttons/basic';
export type BaseTooltipType = {
    className?: string;
    showArrow?: boolean;
    children?: ReactNode;
    /** Controls whether the tooltip stays visible after mouse leaves the element */
    isPersistent?: boolean;
    /** Controls how the tooltip is triggered - either by click or hover */
    triggerType?: "click" | "hover";
    /** Variant props */
    placement?: "top-left" | "top-middle" | "top-right" | "right-top" | "right-middle" | "right-bottom" | "bottom-right" | "bottom-middle" | "bottom-left" | "left-bottom" | "left-middle" | "left-top";
    type?: "neutral" | "fail";
    style?: "basic" | "rich";
    visible?: boolean;
    richContent?: {
        title: string;
        description: string;
        link?: LinkType;
        button?: BasicButtonType;
        onCancel?: () => void;
    };
};
declare const Tooltip: {
    ({ children, content, placement, type, showArrow, style, richContent, isPersistent, triggerType, }: any): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
export default Tooltip;
