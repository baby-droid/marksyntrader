import { ComponentProps, PropsWithChildren } from 'react';

/**
 * Header component.
 * @param {object} PropsWithChildren - Props object with children.
 * @param {React.ReactNode} PropsWithChildren.children - The children nodes to be rendered inside the header.
 * @param {string} PropsWithChildren.className - Additional classes to be applied to the header.
 * @returns {JSX.Element} - Returns the header element.
 */
export declare const Header: {
    ({ children, className, ...rest }: PropsWithChildren<ComponentProps<"header">>): import("react").JSX.Element;
    displayName: string;
};
