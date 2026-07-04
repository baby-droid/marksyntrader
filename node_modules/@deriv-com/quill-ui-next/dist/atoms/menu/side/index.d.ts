import { FunctionComponent, ReactNode } from 'react';
export type MenuSideBarAtomType = {
    className?: string;
    /** Variant props */
    icon: ReactNode;
    iconSelected?: ReactNode;
    isSelected: boolean;
    label?: string;
    badgeLabel?: string;
    direction?: "row" | "column";
    expanded?: boolean;
    onClick?: () => void;
};
declare const MenuSideBarAtom: FunctionComponent<MenuSideBarAtomType>;
export default MenuSideBarAtom;
