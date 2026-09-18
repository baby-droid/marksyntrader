import { FunctionComponent } from 'react';
import { TabAtomType } from '../../../src/atoms/tab';
export type TabType = {
    width: "fill-container" | "hug-content";
    type: "horizontal" | "vertical";
    className?: string;
    tabs: TabAtomType[];
    selected?: TabAtomType;
    size?: "sm" | "md";
    onChange?: (tab: TabAtomType) => void;
};
export declare const Tab: FunctionComponent<TabType>;
export default Tab;
