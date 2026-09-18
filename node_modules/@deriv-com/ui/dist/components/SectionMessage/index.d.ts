import { default as React } from 'react';

type TVariant = "warning" | "info" | "success" | "error" | "general";
type SectionMessageProps = {
    children: JSX.Element | string;
    className?: string;
    ctaSection?: JSX.Element;
    icon?: JSX.Element;
    title?: JSX.Element | string;
    variant?: TVariant;
};
/**
 * `SectionMessage` is a React component designed to display a styled section message.
 * It includes an optional icon, title, description, and call-to-action (CTA) section.
 *
 * @component
 * @param {Object} props - Component props.
 * @param {JSX.Element|string} props.children - The main content or message of the section.
 * @param {string} [props.className] - Optional additional class names for styling.
 * @param {JSX.Element} [props.ctaSection] - Optional CTA section element, such as a button / button group or link.
 * @param {JSX.Element} [props.icon] - Optional icon element.
 * @param {JSX.Element|string} [props.title] - Optional title element or string to summarize the message.
 * @param {TVariant} [props.variant="general"] - Optional variant to style the section with different themes: "warning", "info", "success", "error", or "general".
 */
export declare const SectionMessage: ({ children, className, ctaSection, icon, title, variant, }: SectionMessageProps) => React.JSX.Element;
export {};
