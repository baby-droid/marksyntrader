import { ComponentProps, PropsWithChildren, JSX } from 'react';
import { PlatformSwitcherButton } from './PlatformSwitcherButton';

type TPlatformSwitcher = {
    buttonProps: Omit<ComponentProps<typeof PlatformSwitcherButton>, "isExpanded" | "onClick">;
    bottomLinkLabel?: string | JSX.Element;
    bottomLinkProps?: ComponentProps<"a">;
    itemsWrapperClassName?: string;
    overlayClassName?: string;
};
/**
 * PlatformSwitcher is a React component that renders a button which toggles the visibility of a context menu.
 * It uses an `onClickOutside` hook to detect and handle clicks outside the component area, which toggles the expansion state of the context menu.
 *
 * @component
 * @param {Object} props The properties passed to the component
 * @param {Omit<ComponentProps<typeof PlatformSwitcherButton>, "isExpanded" | "onClick">} props.buttonProps - Props for the PlatformSwitcherButton, excluding `isExpanded` and `onClick`.
 * @param {React.ReactNode} props.children - The children elements to be rendered inside the context menu. These could be additional links, buttons, or other interactive elements.
 * @param {string | JSX.Element} [props.bottomLinkLabel] - Optional label for a bottom link in the context menu, can be a string or JSX element.
 * @param {ComponentProps<"a">} [props.bottomLinkProps] - Optional props for the bottom link, assuming it's rendered as an `<a>` tag.
 * @param {string} props.itemsWrapperClassName - Optional prop for adding additional className to the item's wrapper.
 * @param {string} props.overlayClassName - Optional prop for adding additional className to the overlay.
 *
 * @example
 * <PlatformSwitcher
 *   buttonProps={{ ariaLabel: 'Switch platforms' }}
 *   bottomLinkLabel="More Options"
 *   bottomLinkProps={{ href: '#', target: '_blank' }}
 * >
 *   <div>Option 1</div>
 *   <div>Option 2</div>
 * </PlatformSwitcher>
 */
export declare const PlatformSwitcher: {
    ({ buttonProps, children, bottomLinkLabel, bottomLinkProps, itemsWrapperClassName, overlayClassName, }: PropsWithChildren<TPlatformSwitcher>): JSX.Element;
    displayName: string;
};
export {};
