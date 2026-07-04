import { FunctionComponent, ReactNode } from 'react';
import { BasicButtonType } from '../../buttons/basic';
export type ModalType = {
    className?: string;
    description?: string;
    title?: string;
    showCloseButton?: boolean;
    showHandleBar?: boolean;
    /** Content prop */
    content?: ReactNode;
    /** Variant props */
    height?: "hug-content" | "fill-container";
    type?: "auto" | "bottom" | "overlay";
    buttonPrimary?: BasicButtonType;
    buttonSecondary?: BasicButtonType;
    show: boolean;
    onClose?: () => void;
    customIcon?: ReactNode;
    customImage?: string;
};
export declare const Modal: FunctionComponent<ModalType>;
export default Modal;
