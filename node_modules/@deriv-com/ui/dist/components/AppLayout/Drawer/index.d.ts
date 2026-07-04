import { default as React, ComponentProps } from 'react';

type DrawerProps = ComponentProps<"div"> & {
    isOpen: boolean;
    onCloseDrawer: () => void;
    width?: string;
    overlayClassName?: string;
};
export declare const Drawer: {
    ({ isOpen, onCloseDrawer, width, children, className, overlayClassName, ...rest }: React.PropsWithChildren<DrawerProps>): React.JSX.Element | null;
    Header: {
        ({ onCloseDrawer, children, className, wrapperClassName, ...rest }: React.PropsWithChildren<React.ClassAttributes<HTMLDivElement> & React.HTMLAttributes<HTMLDivElement> & {
            onCloseDrawer: () => void;
            wrapperClassName?: string | undefined;
        }>): React.JSX.Element;
        displayName: string;
    };
    Content: {
        ({ children, className, ...rest }: React.PropsWithChildren<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>>): React.JSX.Element;
        displayName: string;
    };
    Footer: {
        ({ children, className, ...rest }: React.PropsWithChildren<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>>): React.JSX.Element;
        displayName: string;
    };
    displayName: string;
};
export {};
