import { ComponentProps, PropsWithChildren } from 'react';

type ContextMenuProps = ComponentProps<"div"> & {
    isOpen: boolean;
};
export declare const ContextMenu: import('react').ForwardRefExoticComponent<Omit<PropsWithChildren<ContextMenuProps>, "ref"> & import('react').RefAttributes<HTMLDivElement>>;
export {};
