import { FunctionComponent, ReactNode } from 'react';
import { DropdownDataType, DropdownItemType } from '../../../atoms/dropdown/container';
export type DropdownProps = {
    className?: string;
    label?: string;
    placeholder?: string;
    message?: string;
    /** Variant props */
    indicator?: "neutral" | "fail" | "success";
    state?: "default" | "disabled";
    type?: "outline" | "fill";
    size?: "lg" | "md" | "sm";
    textAlignment?: "left" | "center";
    variant?: "labelled" | "labelless";
    /** Custom input props */
    itemSize?: "md" | "sm";
    iconLeft?: ReactNode;
    labelLeft?: string;
    isRequired?: boolean;
    optionalText?: string;
    containerRef?: React.RefObject<HTMLDivElement>;
    customContent?: ReactNode;
    customValue?: string;
    onChange?: (item: DropdownItemType | DropdownItemType[]) => void;
    onClick?: () => void;
    /**Custom Dropdown props */
    data?: DropdownDataType[];
    selected?: DropdownItemType;
    /** Autocomplete props */
    autocomplete?: boolean;
};
export declare const Dropdown: FunctionComponent<DropdownProps>;
export default Dropdown;
