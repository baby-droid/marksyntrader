import { TNotificationsProps } from './types';

export declare const Notifications: {
    ({ notifications, clearNotificationsCallback, isOpen, setIsOpen, componentConfig, className, excludedClickOutsideClass, loadMoreFunction, isLoading, ...rest }: Omit<TNotificationsProps, "style">): import("react").JSX.Element;
    displayName: string;
};
