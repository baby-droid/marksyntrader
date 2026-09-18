import { FunctionComponent, ReactNode } from 'react';
export type TextFieldAddonType = {
    id?: string;
    name?: string;
    className?: string;
    label?: string;
    labelRight?: string;
    message?: string;
    placeholder?: string;
    /** Variant props */
    indicator?: "neutral" | "fail" | "success";
    state?: "default" | "disabled";
    type?: "outline" | "fill";
    variant?: "labelled" | "labelless";
    /** Custom props */
    icon?: ReactNode;
    iconStatus?: ReactNode;
    labelLeft?: string;
    isRequired?: boolean;
    optionalText?: string;
    maxLength?: number;
    showCharacterCounter?: boolean;
    inputType?: "text" | "password" | "number" | "email" | "tel" | "url";
    size?: "lg" | "md" | "sm";
    value?: string | number;
    messages?: {
        text: string;
        type: "neutral" | "fail" | "success";
        icon?: ReactNode;
    }[];
    onChange?: (value: string | number) => void;
};
export declare const TextFieldGroupAddon: FunctionComponent<TextFieldAddonType>;
export default TextFieldGroupAddon;
