import { ReactNode, ElementType } from 'react';
export type BaseTypographyType = {
    className?: string;
    children?: ReactNode;
    /** Variant props */
    type: "heading" | "body" | "caption" | "code";
    /** Size props - only applies to body and code types */
    size?: "sm" | "md" | "lg" | "xl";
    /** Typography style props */
    bold?: boolean;
    /** Heading level - only applies to heading type */
    level?: 1 | 2 | 3 | 4 | 5 | 6 | "mega";
    /** Semantic props */
    as?: ElementType;
};
declare const BaseTypography: ({ className, children, type, size, bold, level, as, }: BaseTypographyType) => import("react/jsx-runtime").JSX.Element;
export default BaseTypography;
