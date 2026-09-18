import { FunctionComponent, ReactNode } from 'react';
import { SegmentedControlAtomType } from '../../../src/atoms/segmented-control';
export type SegmentedControlType = {
    className?: string;
    /** Variant props */
    size?: "sm" | "md" | "lg";
    /** Custom props */
    icon?: ReactNode;
    type?: "single" | "multi";
    items: SegmentedControlAtomType[];
    selected?: string[];
    onChange?: (e: string[]) => void;
};
export declare const SegmentedControl: FunctionComponent<SegmentedControlType>;
export default SegmentedControl;
