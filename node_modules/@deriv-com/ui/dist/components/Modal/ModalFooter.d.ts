import { ComponentProps } from 'react';

type ModalFooterProps = ComponentProps<"div"> & {
    hideBorder?: boolean;
};
export declare const ModalFooter: ({ children, className, hideBorder, ...rest }: ModalFooterProps) => import("react").JSX.Element;
export {};
