import { FunctionComponent, ReactNode } from 'react';
import { TextFieldMessagesType } from '../../../atoms/textfield';
import { ActionSheetType } from '../../action-sheet';
export type DateRangePickerType = {
    className?: string;
    showCharacterCounter?: boolean;
    message?: string;
    indicator?: "neutral" | "fail" | "success";
    state?: "default" | "disabled";
    type?: "outline" | "fill";
    size?: "lg" | "md" | "sm";
    textAlignment?: "left" | "center";
    variant?: "labelled" | "labelless";
    isRequired?: boolean;
    optionalText?: string;
    maxLength?: number;
    value?: [string | number, string | number];
    minDate?: string | Date;
    maxDate?: string | Date;
    onChange?: (value: [string, string]) => void;
    actionSheet?: ActionSheetType;
    dateFormat?: "dd/mm/yyyy" | "mm/dd/yyyy" | "yyyy/mm/dd" | "dd/mm/yy" | "mm/dd/yy" | "yyyy/mm/yy" | "dd-mm-yyyy" | "mm-dd-yyyy" | "yyyy-mm-dd" | "dd-mm-yy" | "mm-dd-yy";
    messages?: {
        text: string;
        type: "neutral" | "fail" | "success";
        icon?: ReactNode;
    }[];
    inputStartDate?: {
        label?: string;
        placeholder?: string;
        message?: string;
        messages?: TextFieldMessagesType[];
        indicator?: "neutral" | "fail" | "success";
    };
    inputEndDate?: {
        label?: string;
        placeholder?: string;
        message?: string;
        messages?: TextFieldMessagesType[];
        indicator?: "neutral" | "fail" | "success";
    };
};
export declare const DateRangePicker: FunctionComponent<DateRangePickerType>;
export default DateRangePicker;
