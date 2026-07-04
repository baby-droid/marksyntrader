import { FunctionComponent, ReactNode } from 'react';
import { BasicButtonType } from '../buttons/basic';
import { IconButtonType } from '../buttons/icon';
export type ActionSheetType = {
    className?: string;
    description?: string;
    title?: string;
    showButtonClose?: boolean;
    controller?: ReactNode;
    content?: ReactNode;
    showHandleBar?: boolean;
    showHeader?: boolean;
    showSearchBar?: boolean;
    buttonPrimary?: BasicButtonType;
    buttonSecondary?: BasicButtonType;
    onClose?: () => void;
    onSearch?: (searchValue: string) => void;
    searchValue?: string;
    searchPlaceholder?: string;
    buttonIcon?: IconButtonType;
    /** Variant props */
    type?: "auto" | "bottom" | "side";
    /** Display props */
    show?: boolean;
};
export declare const ActionSheet: FunctionComponent<ActionSheetType>;
export default ActionSheet;
