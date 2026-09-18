import { FunctionComponent } from 'react';
import { MenuBottomBarBaseType } from '../../../../src/atoms/menu/bottom';
export type NavigationBottomBarType = {
    className?: string;
    onChange?: (item: MenuBottomBarBaseType) => void;
    items: MenuBottomBarBaseType[];
};
export declare const NavigationBottomBar: FunctionComponent<NavigationBottomBarType>;
export default NavigationBottomBar;
