import { FunctionComponent, CSSProperties } from 'react';
export type NotificationStatusIconProps = {
    className?: string;
    showBadge?: boolean;
    style?: CSSProperties;
    /** Variant props */
    type?: "informative" | "success" | "warning" | "danger";
};
export declare const NotificationStatusIcon: FunctionComponent<NotificationStatusIconProps>;
export default NotificationStatusIcon;
