import { FunctionComponent, ReactNode } from 'react';
export type TextAreaType = {
    id?: string;
    name?: string;
    className?: string;
    label?: string;
    showCharacterCounter?: boolean;
    input?: string;
    message?: string;
    placeholder?: string;
    /** Variant props */
    indicator?: "neutral" | "fail" | "success";
    state?: "default" | "disabled";
    type?: "outline" | "fill";
    variant?: "labelled" | "labelless";
    /** Custom props */
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    isRequired?: boolean;
    optionalText?: string;
    maxLength?: number;
    inputType?: "text" | "password" | "number" | "email" | "tel" | "url";
    value?: string | number;
    messages?: {
        text: string;
        type: "neutral" | "fail" | "success";
        icon?: ReactNode;
    }[];
    onChange?: (value: string | number) => void;
};
export declare const TextArea: FunctionComponent<TextAreaType>;
export default TextArea;
