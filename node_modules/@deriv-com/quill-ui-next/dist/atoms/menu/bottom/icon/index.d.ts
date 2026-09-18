import { FunctionComponent, ReactNode } from 'react';
export type MenuBottomBarIconType = {
    className?: string;
    showBadge?: boolean;
    showFocusRing?: boolean;
    /** Variant props */
    state?: "default" | "selected";
    icon: ReactNode;
    label?: string;
};
declare const MenuBottomBarItemIcon: FunctionComponent<MenuBottomBarIconType>;
export default MenuBottomBarItemIcon;
