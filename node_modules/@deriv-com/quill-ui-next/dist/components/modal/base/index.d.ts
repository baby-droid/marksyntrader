import { FunctionComponent, ReactNode } from 'react';
import { BasicButtonType } from '../../buttons/basic';
export type BaseModalType = {
    className?: string;
    description?: string;
    title?: string;
    /** Variant props */
    height?: "hug-content" | "fill-container";
    type?: "auto" | "bottom" | "overlay";
    buttonPrimary?: BasicButtonType;
    buttonSecondary?: BasicButtonType;
    show: boolean;
    onClose?: () => void;
    customIcon?: ReactNode;
    customImage?: string;
    /** Display props */
    showCloseButton?: boolean;
    showHandleBar?: boolean;
    /** Content prop */
    content?: ReactNode;
};
declare const ModalBase: FunctionComponent<BaseModalType>;
export default ModalBase;
