import { default as React, RefObject, CSSProperties, ReactNode } from 'react';
import { ActionSheetType } from '../../../components/action-sheet';
export type DropdownItemType = {
    label: string;
    value: string;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    className?: string;
    itemKey?: number;
    state?: "default" | "disabled";
};
export type DropdownDataType = {
    title?: string;
    items: DropdownItemType[];
    extra?: string;
};
export type DropdownContainerType = {
    className?: string;
    containerSize?: "default" | "sm" | "md" | "lg";
    width?: CSSProperties["width"];
    /** Custom props */
    parent: RefObject<HTMLElement | null>;
    isOpen?: boolean;
    data?: DropdownDataType[];
    itemSize?: "sm" | "md";
    multiple?: boolean;
    selected?: DropdownItemType | DropdownItemType[];
    offsetTop?: number;
    textAlignment?: "left" | "center";
    customContent?: ReactNode;
    actionSheet?: ActionSheetType;
    onChange?: (item: DropdownItemType | DropdownItemType[]) => void;
    onActionSheetClose?: () => void;
};
export declare const DropdownContainerAtom: React.FC<DropdownContainerType>;
export default DropdownContainerAtom;
