import { default as React, FunctionComponent, ReactNode } from 'react';
import { BasicButtonType } from '../../buttons/basic';
export type CardLayout = "vertical" | "horizontal";
export type BaseCardProps = {
    className?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    image?: string;
    showFocusRing?: boolean;
    linkLabel?: string;
    linkIcon?: ReactNode;
    linkOnClick?: () => void;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    /** Button props */
    primaryVerticalButton?: BasicButtonType;
    secondaryVerticalButton?: BasicButtonType;
    primaryHorizontalButton?: BasicButtonType;
    secondaryHorizontalButton?: BasicButtonType;
    /** Variant props */
    size?: "sm" | "md" | "lg";
    state?: "default" | "disabled";
    type?: "elevate" | "outline" | "fill" | "ghost";
    /** Layout props */
    layout: CardLayout;
    renderLayout: (props: BaseCardRenderProps) => React.ReactElement;
};
export type BaseCardRenderProps = {
    cardId: string;
    className: string;
    size: "sm" | "md" | "lg";
    state: "default" | "disabled";
    type: "elevate" | "outline" | "fill" | "ghost";
    focus: boolean;
    handleFocus: () => void;
    handleBlur: () => void;
    isClickable: boolean;
    title?: string;
    subtitle?: string;
    description?: string;
    image?: string;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    linkLabel?: string;
    linkIcon?: ReactNode;
    linkOnClick?: () => void;
    primaryVerticalButton?: BasicButtonType;
    secondaryVerticalButton?: BasicButtonType;
    primaryHorizontalButton?: BasicButtonType;
    secondaryHorizontalButton?: BasicButtonType;
};
declare const BaseCard: FunctionComponent<BaseCardProps>;
export default BaseCard;
