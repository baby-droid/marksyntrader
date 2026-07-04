import { FunctionComponent } from 'react';
export type BreadcrumbType = {
    className?: string;
    label?: string;
    showFocusRing?: boolean;
    /** Variant props */
    variant?: "desktop" | "mobile";
    size?: "sm" | "md";
    state?: "default" | "selected";
    /** Event handlers */
    onClick?: () => void;
};
export declare const Breadcrumb: FunctionComponent<BreadcrumbType>;
export default Breadcrumb;
