import { FunctionComponent, ReactNode } from 'react';
import { DropdownDataType, DropdownItemType } from '../../../../src/atoms/dropdown/container';
export type PhoneNumberType = {
    className?: string;
    label?: string;
    labelLeft?: string;
    labelLeftValue?: string;
    placeholder?: string;
    message?: string;
    /** Variant props */
    indicator?: "neutral" | "fail" | "success";
    state?: "default" | "disabled";
    type?: "outline" | "fill";
    size?: "lg" | "md" | "sm";
    textAlignment?: "left" | "center";
    /** Custom  input props */
    itemSize?: "md" | "sm";
    iconRight?: ReactNode;
    isRequired?: boolean;
    optionalText?: string;
    containerRef?: React.RefObject<HTMLDivElement>;
    customContent?: ReactNode;
    onChange?: (item: DropdownItemType | DropdownItemType[]) => void;
    onClick?: () => void;
    variant?: "labelled" | "labelless";
    value?: string | number;
    /**Custom Dropdown props */
    data?: DropdownDataType[];
    selected?: DropdownItemType;
};
export declare const PhoneNumber: FunctionComponent<PhoneNumberType>;
export default PhoneNumber;
