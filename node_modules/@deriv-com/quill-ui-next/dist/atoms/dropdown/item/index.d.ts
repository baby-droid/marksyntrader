import { ReactNode } from 'react';
import { DropdownItemType } from '../container';
export type DropdownItemAtomType = {
    className?: string;
    label?: string;
    showFocusRing?: boolean;
    /** Variant props */
    selected?: boolean;
    size?: "sm" | "md";
    state?: "default" | "disabled";
    textAlignment?: "left" | "center";
    width?: "fill" | "fit-content";
    /** Custom props */
    type?: "text" | "checkbox";
    onClick?: (e: DropdownItemType) => void;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
    value?: string;
    itemKey?: number;
    noFocus?: boolean;
    ref?: React.Ref<HTMLDivElement>;
};
export declare const DropdownItemAtom: import('react').ForwardRefExoticComponent<Omit<DropdownItemAtomType, "ref"> & import('react').RefAttributes<HTMLDivElement>>;
export default DropdownItemAtom;
