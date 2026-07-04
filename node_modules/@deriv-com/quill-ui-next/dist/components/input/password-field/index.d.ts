import { FunctionComponent, ReactNode } from 'react';
export type PasswordFieldType = {
    id?: string;
    name?: string;
    className?: string;
    label?: string;
    placeholder?: string;
    showCharacterCounter?: boolean;
    message?: string;
    /** Variant props */
    indicator?: "neutral" | "fail" | "success";
    state?: "default" | "disabled";
    type?: "outline" | "fill";
    size?: "lg" | "md" | "sm";
    textAlignment?: "left" | "center";
    /** Custom props */
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    iconStatus?: ReactNode;
    labelLeft?: string;
    isRequired?: boolean;
    optionalText?: string;
    maxLength?: number;
    value?: string | number;
    onChange?: (value: string | number) => void;
    messages?: {
        text: string;
        type: "neutral" | "fail" | "success";
        icon?: ReactNode;
    }[];
    variant?: "labelled" | "labelless";
};
export declare const PasswordField: FunctionComponent<PasswordFieldType>;
export default PasswordField;
