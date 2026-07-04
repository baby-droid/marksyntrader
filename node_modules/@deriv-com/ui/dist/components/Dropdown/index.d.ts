import { default as React, HtmlHTMLAttributes } from 'react';
import { Input } from '../Input';
import { TGenericSizes } from '../../types';

type InputProps = React.ComponentProps<typeof Input>;
type TProps = HtmlHTMLAttributes<HTMLInputElement> & {
    chevronIcon?: React.ReactNode;
    disabled?: boolean;
    emptyResultMessage?: string;
    errorMessage?: InputProps["message"];
    icon?: React.ReactNode;
    isFullWidth?: boolean;
    isRequired?: boolean;
    label?: InputProps["label"];
    list: {
        text?: string | JSX.Element;
        value?: string;
    }[];
    listHeight?: Extract<TGenericSizes, "lg" | "md" | "sm" | "xs">;
    name: InputProps["name"];
    onSearch?: (inputValue: string) => void;
    onSelect: (value: string) => void;
    shouldClearValue?: boolean;
    value?: InputProps["value"];
    variant?: "comboBox" | "prompt";
};
export declare const Dropdown: ({ chevronIcon, disabled, emptyResultMessage, errorMessage, icon, isFullWidth, label, list, listHeight, name, onSearch, onSelect, shouldClearValue, value, variant, ...rest }: TProps) => React.JSX.Element;
export {};
