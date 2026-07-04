import { FunctionComponent } from 'react';
export type BadgeType = {
    className?: string;
    label?: string;
    showLabel?: boolean;
    /** Variant props */
    size?: "sm" | "md" | "lg";
    /** Custom props */
    style?: "notification";
};
declare const Badge: FunctionComponent<BadgeType>;
export default Badge;
