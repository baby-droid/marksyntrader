import { FunctionComponent, ReactNode } from 'react';
export type TextFieldStepperType = {
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
    textAlignment?: "left" | "center";
    size?: "lg" | "md" | "sm";
    /** Custom props */
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    iconStatus?: ReactNode;
    labelLeft?: string;
    isRequired?: boolean;
    optionalText?: string;
    maxLength?: number;
    messages?: {
        text: string;
        type: "neutral" | "fail" | "success";
        icon?: ReactNode;
    }[];
    onChange?: (value: string | number) => void;
    variant?: "labelled" | "labelless";
    value?: string | number;
    decimalPlaces?: number;
    maxValue?: number;
    minValue?: number;
    increment?: string | number;
    split?: boolean;
};
export declare const TextFieldStepper: FunctionComponent<TextFieldStepperType>;
export default TextFieldStepper;
