import { FunctionComponent, ReactNode } from 'react';
export type SelectionControlType = {
    className?: string;
    label?: string;
    iconData?: string;
    showInfoIcon?: boolean;
    /** Variant props */
    indicator?: "unchecked" | "checked" | "indeterminate";
    size?: "sm" | "md";
    state?: "default" | "disabled";
    type?: "checkbox" | "radio";
    /** Custom props */
    icon?: ReactNode;
    onChange?: (indicator: "unchecked" | "checked" | "indeterminate") => void;
    getCurrentIndicator?: () => "unchecked" | "checked" | "indeterminate";
};
export declare const SelectionControl: FunctionComponent<SelectionControlType>;
export default SelectionControl;
