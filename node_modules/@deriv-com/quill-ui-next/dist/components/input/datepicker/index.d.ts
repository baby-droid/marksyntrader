import { FunctionComponent, ReactNode } from 'react';
export type DatePickerType = {
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
    variant?: "labelled" | "labelless";
    /** Custom props */
    isRequired?: boolean;
    optionalText?: string;
    maxLength?: number;
    value?: string | number;
    minDate?: string | Date;
    maxDate?: string | Date;
    onChange?: (value: string | number) => void;
    dateFormat?: "dd/mm/yyyy" | "mm/dd/yyyy" | "yyyy/mm/dd" | "dd/mm/yy" | "mm/dd/yy" | "yyyy/mm/yy" | "dd-mm-yyyy" | "mm-dd-yyyy" | "yyyy-mm-dd" | "dd-mm-yy" | "mm-dd-yy";
    messages?: {
        text: string;
        type: "neutral" | "fail" | "success";
        icon?: ReactNode;
    }[];
};
export declare const Datepicker: FunctionComponent<DatePickerType>;
export default Datepicker;
