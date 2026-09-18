import { default as React } from 'react';
import { Modal } from '../Modal';

type TDialogProps = React.ComponentProps<typeof Modal> & {
    className?: string;
};
export declare const Dialog: {
    ({ children, className, ...rest }: TDialogProps): React.JSX.Element;
    Header: ({ children, className, hideCloseIcon, textClassName, ...rest }: Omit<React.ClassAttributes<HTMLDivElement> & React.HTMLAttributes<HTMLDivElement> & {
        hideCloseIcon?: boolean | undefined;
        onRequestClose?: VoidFunction | undefined;
        shouldShowBorder?: boolean | undefined;
        hideBorder?: boolean | undefined;
    }, "hideBorder"> & {
        hideCloseIcon?: boolean | undefined;
        textClassName?: string | undefined;
    }) => React.JSX.Element;
    Body: ({ children, className, ...rest }: React.ClassAttributes<HTMLDivElement> & React.HTMLAttributes<HTMLDivElement>) => React.JSX.Element;
    Footer: ({ className, children, ...rest }: React.ClassAttributes<HTMLDivElement> & React.HTMLAttributes<HTMLDivElement> & {
        hideBorder?: boolean | undefined;
    }) => React.JSX.Element;
    setAppElement: typeof import('react-modal').setAppElement;
};
export {};
