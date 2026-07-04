import { FunctionComponent } from 'react';
import { MenuSideBarAtomType } from '../../../../src/atoms/menu/side';
export type NavigationSideBarType = {
    className?: string;
    onChange?: (item: MenuSideBarAtomType) => void;
    items: MenuSideBarAtomType[][];
    stickyItems: MenuSideBarAtomType[];
    type?: "expandable" | "fixed";
    selected?: MenuSideBarAtomType;
    expanded?: boolean;
};
export declare const NavigationSideBar: FunctionComponent<NavigationSideBarType>;
export default NavigationSideBar;
