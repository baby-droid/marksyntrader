import { ReactElement, ReactNode } from 'react';

type TLanguageItem = {
    code: string;
    displayName: string | ReactElement;
    icon: ReactNode;
};
type TLangComponent = {
    language: TLanguageItem;
    onButtonClick: () => void;
    selectedLanguage: string;
};
export declare const LanguageItem: {
    ({ language, onButtonClick, selectedLanguage, }: TLangComponent): import("react").JSX.Element;
    displayName: string;
};
export {};
