import { FunctionComponent } from 'react';
export type NotificationBannerType = {
    className?: string;
    title?: string;
    message?: string;
    showButtonClose?: boolean;
    type?: "informative" | "success" | "warning" | "danger";
    onClose?: () => void;
};
export declare const NotificationBanner: FunctionComponent<NotificationBannerType>;
export default NotificationBanner;
