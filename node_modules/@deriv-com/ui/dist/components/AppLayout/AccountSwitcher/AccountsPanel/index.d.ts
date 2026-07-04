import { ComponentProps, PropsWithChildren } from 'react';

type AccountsListProps = Omit<ComponentProps<"div">, "title"> & {
    title: string | JSX.Element;
    headerClassName?: string;
    isOpen?: boolean;
};
export declare const AccountsPanel: ({ children, title, className, headerClassName, isOpen, ...rest }: PropsWithChildren<AccountsListProps>) => import("react").JSX.Element;
export {};
