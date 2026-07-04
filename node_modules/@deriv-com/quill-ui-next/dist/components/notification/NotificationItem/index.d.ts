import { FunctionComponent } from 'react';
export type NotificationItemType = {
    className?: string;
    date?: string;
    time?: string;
    title?: string;
    message?: string;
    timeFormat?: string;
    showDivider?: boolean;
    showFocusRing?: boolean;
    /** Variant props */
    variant?: "desktop" | "mobile" | "auto";
    state?: "default" | "swipe";
    type?: "informative" | "success" | "warning" | "danger";
    /** Action handlers */
    onMarkAsRead?: () => void;
    onDelete?: () => void;
};
export declare const NotificationItem: FunctionComponent<NotificationItemType>;
export default NotificationItem;
