import { default as React, ComponentProps, ReactNode } from 'react';
import { Placement } from '@popperjs/core';

type AsElement = "a" | "div" | "button";
export type TooltipProps<T extends AsElement> = ComponentProps<T> & {
    as?: T;
    tooltipContainerClassName?: string;
    tooltipContent: ReactNode;
    tooltipOffset?: number;
    tooltipPosition?: Placement;
    variant?: "general" | "error";
    hideTooltip?: boolean;
};
/**
 * A component that renders an icon, a link, or a div with a tooltip.
 *
 * @param {"a" | "div" | "button"} as - The HTML element or React component to render, which can be "a", "div", or "button".
 * @param {ComponentProps<"a" | "div" | "button">} ...rest - Component props based on the `as` property.
 * @param {import("@popperjs/core").Placement} tooltipPosition - The position of the tooltip relative to the element, using the Placement type from Popper.js.
 * @param {number} tooltipOffset - The distance between the tooltip and the content.
 * @param {React.ReactNode} [icon] - The icon to display. This can be any React node.
 * @param {string} [href] - The URL the link points to. Required and applicable only when `as` is "a".
 * @param {string} tooltipContent - The content to display inside the tooltip.
 * @param {string} [tooltipContainerClassName] - Optional class name for the tooltip container.
 * @param {TooltipVariantType} [variant="general"] - The variant of the tooltip, which can be "general" or "error".
 * @param {boolean} [hideTooltip=false] - If true, the tooltip will not be displayed.
 *
 * @example
 * // To render a button with a tooltip
 * <Tooltip as="button" tooltipContent="Save" tooltipPosition="bottom">
 *   Save
 * </Tooltip>
 *
 * @example
 * // To render a link with a tooltip and an icon
 * <Tooltip as="a" href="https://example.com" tooltipContent="Go to Example" tooltipPosition="right" icon={<YourIcon />}>
 *   Visit Example.com
 * </Tooltip>
 *
 * @returns {JSX.Element} The rendered component.
 */
export declare const Tooltip: React.ForwardRefExoticComponent<(Omit<React.ClassAttributes<HTMLDivElement> & React.HTMLAttributes<HTMLDivElement> & {
    as?: AsElement | undefined;
    tooltipContainerClassName?: string | undefined;
    tooltipContent: ReactNode;
    tooltipOffset?: number | undefined;
    tooltipPosition?: Placement | undefined;
    variant?: "general" | "error" | undefined;
    hideTooltip?: boolean | undefined;
} & {
    children?: React.ReactNode;
}, "ref"> | Omit<React.ClassAttributes<HTMLButtonElement> & React.ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: AsElement | undefined;
    tooltipContainerClassName?: string | undefined;
    tooltipContent: ReactNode;
    tooltipOffset?: number | undefined;
    tooltipPosition?: Placement | undefined;
    variant?: "general" | "error" | undefined;
    hideTooltip?: boolean | undefined;
} & {
    children?: React.ReactNode;
}, "ref"> | Omit<React.ClassAttributes<HTMLAnchorElement> & React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as?: AsElement | undefined;
    tooltipContainerClassName?: string | undefined;
    tooltipContent: ReactNode;
    tooltipOffset?: number | undefined;
    tooltipPosition?: Placement | undefined;
    variant?: "general" | "error" | undefined;
    hideTooltip?: boolean | undefined;
} & {
    children?: React.ReactNode;
}, "ref">) & React.RefAttributes<HTMLElement | null>>;
export {};
