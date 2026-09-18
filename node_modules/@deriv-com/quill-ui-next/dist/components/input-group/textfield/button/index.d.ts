import { FunctionComponent, ReactNode } from 'react';
import { BasicButtonType } from '../../../buttons/basic';
export type TextFieldButtonType = {
    /** Variant props */
    indicator?: "neutral" | "fail" | "success";
    state?: "default" | "disabled";
    type?: "outline" | "fill";
    variant?: "labelled" | "labelless";
    id?: string;
    name?: string;
    className?: string;
    label?: string;
    message?: string;
    placeholder?: string;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    isRequired?: boolean;
    optionalText?: string;
    maxLength?: number;
    showCharacterCounter?: boolean;
    inputType?: "text" | "password" | "number" | "email" | "tel" | "url";
    size?: "lg" | "sm";
    value?: string | number;
    button?: BasicButtonType;
    buttonPosition?: "right" | "bottom";
    hideButton?: boolean;
    messages?: {
        text: string;
        type: "neutral" | "fail" | "success";
        icon?: ReactNode;
    }[];
    onChange?: (value: string | number) => void;
};
export declare const TextFieldGroupButton: FunctionComponent<TextFieldButtonType>;
export default TextFieldGroupButton;
