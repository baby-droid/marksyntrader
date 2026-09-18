import { ReactNode } from 'react';
import { DropdownDataType, DropdownItemType } from '../../../atoms/dropdown/container';
export type ChipBaseType = {
    className?: string;
    counter?: string;
    label?: string;
    labelTag?: string;
    /** Variant props */
    itemSelected?: boolean;
    size?: "sm" | "md" | "lg";
    state?: "default" | "expand" | "disabled";
    /** Custom props */
    icon?: ReactNode;
    selected?: DropdownItemType | DropdownItemType[];
    type?: "multiSelect" | "singleSelect";
    variant?: "dropdown" | "dismissable" | "selectable";
    onClick?: () => void;
    onChange?: (item: DropdownItemType | DropdownItemType[]) => void;
    options?: DropdownDataType[];
};
export interface ChipDropdownRef {
    updateItems: (newItems: DropdownDataType[]) => void;
}
declare const ChipBase: import('react').ForwardRefExoticComponent<ChipBaseType & import('react').RefAttributes<ChipDropdownRef>>;
export default ChipBase;
