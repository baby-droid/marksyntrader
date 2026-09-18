import { ComponentProps, PropsWithChildren } from 'react';

type DrawerHeaderProps = ComponentProps<"div"> & {
    onCloseDrawer: () => void;
    wrapperClassName?: string;
};
/**
 * DrawerHeader component.
 * @param {VoidFunction} onCloseDrawer
 * @param {React.ReactNode} children - The children nodes to be rendered inside the header.
 * @param {string} className - Applies on the right side content wrapper of the Drawerheader.
 * @param {string} WrapperClassName - Applies on the header wrapper
 *
 * @returns {JSX.Element} - Returns the header element.
 */
export declare const DrawerHeader: {
    ({ onCloseDrawer, children, className, wrapperClassName, ...rest }: PropsWithChildren<DrawerHeaderProps>): import("react").JSX.Element;
    displayName: string;
};
export {};
