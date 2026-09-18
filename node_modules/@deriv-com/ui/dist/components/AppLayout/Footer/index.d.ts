import { ComponentProps, PropsWithChildren } from 'react';

/**
 * Footer component.
 * @param {object} PropsWithChildren - Props object with children.
 * @param {React.ReactNode} PropsWithChildren.children - The children nodes to be rendered inside the footer.
 * @param {string} PropsWithChildren.className - Additional classes to be applied to the footer.
 * @returns {JSX.Element} - Returns the footer element.
 */
export declare const Footer: {
    ({ children, className, ...rest }: PropsWithChildren<ComponentProps<"footer">>): import("react").JSX.Element;
    displayName: string;
};
