import { TAccount } from '../types';

type AccountSwitcherProps = {
    account: TAccount;
    onSelectAccount: () => void;
    onResetBalance?: () => void;
};
export declare const AccountsItem: ({ account, onSelectAccount, onResetBalance, }: AccountSwitcherProps) => import("react").JSX.Element;
export {};
