import { FunctionComponent, ReactNode } from 'react';
import { TagType } from '../../components/tag';
import { BadgeType } from '../../components/badge/BadgeDefault';
export type TabAtomType = {
    className?: string;
    label?: string;
    /** Variant props */
    size?: "sm" | "md";
    state?: "default" | "selected" | "disabled";
    style?: "icon-top" | "icon-left";
    tag?: TagType;
    badge?: BadgeType;
    icon?: ReactNode;
    labelIcon?: ReactNode;
    selected?: boolean;
    type?: "horizontal" | "vertical";
    onClick?: () => void;
};
declare const TabAtom: FunctionComponent<TabAtomType>;
export default TabAtom;
