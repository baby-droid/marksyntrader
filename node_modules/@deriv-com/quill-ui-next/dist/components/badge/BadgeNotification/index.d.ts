import { FunctionComponent } from 'react';
export type BadgeNotificationType = {
    className?: string;
    label?: string;
    showLabel?: boolean;
    /** Variant props */
    size?: "sm" | "md" | "lg";
};
export declare const BadgeNotification: FunctionComponent<BadgeNotificationType>;
export default BadgeNotification;
