import { ComponentProps } from 'react';

type ModalHeaderProps = ComponentProps<'div'> & {
    hideCloseIcon?: boolean;
    onRequestClose?: VoidFunction;
    shouldShowBorder?: boolean;
    hideBorder?: boolean;
};
export declare const ModalHeader: ({ children, hideCloseIcon, className, onRequestClose, hideBorder, ...rest }: ModalHeaderProps) => import("react").JSX.Element;
export {};
