import { LanguageItem } from './LanguageItem';
import { ComponentProps } from 'react';

type TLanguageDrawer = {
    onClose: () => void;
    onLanguageSwitch: (code: string) => void;
    selectedLanguage: string;
    isOpen: boolean;
    wrapperClassName?: string;
};
type TLanguagesItemsDrawerProps = {
    languages: ComponentProps<typeof LanguageItem>['language'][];
} & TLanguageDrawer;
export declare const MobileLanguagesDrawer: {
    ({ languages, onClose, onLanguageSwitch, selectedLanguage, isOpen, wrapperClassName, }: TLanguagesItemsDrawerProps): import("react").JSX.Element;
    displayName: string;
};
export {};
