import { ReactElement } from 'react';
import { TabTitleProps } from '../../Tabs/TabTitle';
import { TAccount } from './types';

type AccountSwitcherProps = {
    activeAccount: TAccount;
    buttonClassName?: string;
    children?: ReactElement<TabTitleProps>[];
    isDisabled?: boolean;
    tabsLabels?: {
        demo: string;
        real: string;
    };
    modalContentStyle?: {
        content?: React.CSSProperties;
    };
};
export declare const AccountSwitcher: {
    ({ children, activeAccount, isDisabled, buttonClassName, tabsLabels, modalContentStyle, }: AccountSwitcherProps): import("react").JSX.Element;
    Tab: ({ title, className, children, }: {
        children?: import('react').ReactNode;
        icon?: import('react').ReactNode;
        title: string | JSX.Element;
        className?: string | undefined;
    } & {
        children?: import('react').ReactNode;
    }) => import("react").JSX.Element;
    AccountsPanel: ({ children, title, className, headerClassName, isOpen, ...rest }: import('react').PropsWithChildren<Omit<import('react').DetailedHTMLProps<import('react').HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "title"> & {
        title: string | JSX.Element;
        headerClassName?: string | undefined;
        isOpen?: boolean | undefined;
    }>) => import("react").JSX.Element;
    AccountsItem: ({ account, onSelectAccount, onResetBalance, }: {
        account: TAccount;
        onSelectAccount: () => void;
        onResetBalance?: (() => void) | undefined;
    }) => import("react").JSX.Element;
    TotalAsset: ({ title, description, value, className, ...rest }: Omit<import('react').DetailedHTMLProps<import('react').HTMLAttributes<HTMLDivElement>, HTMLDivElement>, "title"> & {
        title: string | JSX.Element;
        description: string | JSX.Element;
        value: string | JSX.Element;
    }) => import("react").JSX.Element;
    TradersHubLink: ({ children, className, href, target, ...rest }: import('react').PropsWithChildren<import('react').DetailedHTMLProps<import('react').AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>>) => import("react").JSX.Element;
    Footer: ({ children, className, ...rest }: import('react').PropsWithChildren<import('react').DetailedHTMLProps<import('react').HTMLAttributes<HTMLDivElement>, HTMLDivElement>>) => import("react").JSX.Element;
    setAppElement: typeof import('react-modal').setAppElement;
    DisplayName: string;
};
export {};
