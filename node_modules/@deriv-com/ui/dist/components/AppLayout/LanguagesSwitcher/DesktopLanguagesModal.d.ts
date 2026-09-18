import { default as React, ComponentProps, ReactElement } from 'react';
import { LanguageItem } from './LanguageItem';

type TLanguagesModalProps = {
    isModalOpen: boolean;
    languages: ComponentProps<typeof LanguageItem>['language'][];
    onClose: () => void;
    onLanguageSwitch: (code: string) => void;
    selectedLanguage: string;
    headerTitle: string | ReactElement;
};
export declare const DesktopLanguagesModal: {
    ({ isModalOpen, languages, onClose, onLanguageSwitch, selectedLanguage, headerTitle, }: TLanguagesModalProps): React.JSX.Element;
    displayName: string;
};
export {};
