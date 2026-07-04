import { FunctionComponent, ReactNode } from 'react';
export type SearchFieldType = {
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
    isRequired?: boolean;
    optionalText?: string;
    maxLength?: number;
    value?: string | number;
    onChange?: (value: string | number) => void;
    inputType?: "text" | "password" | "number" | "email" | "tel" | "url";
    messages?: {
        text: string;
        type: "neutral" | "fail" | "success";
        icon?: ReactNode;
    }[];
};
export declare const SearchField: FunctionComponent<SearchFieldType>;
export default SearchField;
