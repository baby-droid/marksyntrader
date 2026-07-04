import { FunctionComponent, ReactNode } from 'react';
import { DropdownDataType, DropdownItemType } from '../../../../atoms/dropdown/container';
import { ActionSheetType } from '../../../action-sheet';
export type GenericWheelpickerType = {
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
    /** Custom  input props */
    itemSize?: "md" | "sm";
    itemWidth?: "fill" | "fit-content";
    iconLeft?: ReactNode;
    labelLeft?: string;
    isRequired?: boolean;
    optionalText?: string;
    containerRef?: React.RefObject<HTMLDivElement>;
    customValue?: string;
    onChange?: (item: DropdownItemType | DropdownItemType[]) => void;
    onClick?: () => void;
    variant?: "labelled" | "labelless";
    actionsheet?: ActionSheetType;
    /**Custom Dropdown props */
    data?: DropdownDataType[];
    selected?: DropdownItemType[];
};
declare const GenericWheelpicker: FunctionComponent<GenericWheelpickerType>;
export default GenericWheelpicker;
