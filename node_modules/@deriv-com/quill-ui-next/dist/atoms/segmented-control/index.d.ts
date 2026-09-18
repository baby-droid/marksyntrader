import { FunctionComponent, ReactNode } from 'react';
export type SegmentedControlAtomType = {
    className?: string;
    label?: string;
    /** Variant props */
    size?: "sm" | "md" | "lg";
    state?: "default" | "selected" | "disabled";
    /** Custom props */
    icon?: ReactNode;
    type?: "single" | "multi";
    isSelected?: boolean;
    value?: string;
    onClick?: (e: string) => void;
};
declare const SegmentedControlAtom: FunctionComponent<SegmentedControlAtomType>;
export default SegmentedControlAtom;
