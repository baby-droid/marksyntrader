import { FunctionComponent, ReactNode } from 'react';
import { LinkType } from '../links';
import { BaseButtonType } from '../buttons/base';
export type SectionMessageType = {
    className?: string;
    message?: string;
    title?: string;
    icon?: string;
    showIcon?: boolean;
    showCloseButton?: boolean;
    buttonPrimary?: BaseButtonType;
    buttonSecondary?: BaseButtonType;
    onClickClose?: () => void;
    /** Variant props */
    indicator?: "danger" | "warning" | "success" | "information" | "default";
    size?: "sm" | "md";
    /** Custom props */
    customIcon?: ReactNode;
    link1?: Omit<LinkType, "color">;
    link2?: Omit<LinkType, "color">;
};
export declare const SectionMessage: FunctionComponent<SectionMessageType>;
export default SectionMessage;
