import { FunctionComponent, ReactNode } from 'react';
export type MenuBottomBarBaseType = {
    className?: string;
    /** Variant props */
    state?: "default" | "selected";
    icon: ReactNode;
    iconSelected?: ReactNode;
    label?: string;
    badgeLabel?: string;
    onClick?: () => void;
};
declare const MenuBottomBarBase: FunctionComponent<MenuBottomBarBaseType>;
export default MenuBottomBarBase;
