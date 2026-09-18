import { ComponentProps, ReactNode, JSX } from 'react';

type TPlatformSwitcherItem = ComponentProps<"a"> & {
    icon: ReactNode;
    active: boolean;
    description: JSX.Element | string;
};
/**
 * PlatformSwitcherItem component renders an anchor tag styled as an item in a platform switcher UI,
 * with an icon and a description that can be a simple text or an element.
 *
 * @param {TPlatformSwitcherItem} props - The properties passed to the component including icon, description,
 * active state, and any other anchor tag attributes.
 * @property {ReactNode} icon - The icon to be displayed inside the item.
 * @property {boolean} active - Indicates if the current item is active.
 * @property {JSX.Element|string} description - The content description of the item, can be a string or JSX.
 * @returns {JSX.Element} The rendered anchor element styled as a platform switcher item.
 */
export declare const PlatformSwitcherItem: {
    ({ icon, description, active, className, ...props }: TPlatformSwitcherItem): JSX.Element;
    displayName: string;
};
export {};
