import { FunctionComponent, ReactNode } from 'react';
export type PaginationButtonAtomType = {
    className?: string;
    label?: string | ReactNode;
    /** Variant props */
    state?: "default" | "disabled" | "selected";
    /** Custom props */
    variant?: "button" | "page" | "bullet";
    icon?: ReactNode;
    isSelected?: boolean;
    onClick?: () => void;
};
declare const PaginationAtom: FunctionComponent<PaginationButtonAtomType>;
export default PaginationAtom;
