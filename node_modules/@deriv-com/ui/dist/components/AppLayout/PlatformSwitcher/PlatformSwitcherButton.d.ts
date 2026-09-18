import { ComponentProps, ReactNode } from 'react';

type TPlatformSwitcherButton = ComponentProps<"button"> & {
    icon: ReactNode;
    isExpanded: boolean;
    iconSize?: number;
    iconClassName?: string;
};
/**
 * PlatformSwitcherButton component renders a button with an icon and a chevron that indicates expansion state.
 * @param {TPlatformSwitcherButton} props - The properties passed to the component.
 * @property {ReactNode} icon - The icon to be displayed inside the button.
 * @property {boolean} isExpanded - Flag to determine if the switcher is expanded.
 * @property {number} [iconSize=16] - Optional size for the chevron icon.
 * @property {string} [iconClassName] - Optional additional class names for the chevron icon.
 * @returns {JSX.Element} The PlatformSwitcherButton component.
 */
export declare const PlatformSwitcherButton: {
    ({ icon, className, iconSize, iconClassName, isExpanded, ...props }: TPlatformSwitcherButton): import("react").JSX.Element;
    displayName: string;
};
export {};
