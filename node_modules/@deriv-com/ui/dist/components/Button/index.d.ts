import { ComponentProps, ReactElement, ReactNode } from 'react';
import { TGenericSizes } from '../../types';
import { Text } from '../Text';

type TVariant = "contained" | "ghost" | "outlined";
type TColor = "black" | "primary" | "primary-light" | "primary-transparent" | "white";
type TBorderWidth = Extract<TGenericSizes, 'md' | 'sm' | 'lg'> | 'none';
interface ButtonProps extends ComponentProps<"button"> {
    borderWidth?: TBorderWidth;
    color?: TColor;
    icon?: ReactElement | ReactNode;
    isFullWidth?: boolean;
    isLoading?: boolean;
    rounded?: Extract<TGenericSizes, "lg" | "md" | "sm">;
    size?: Extract<TGenericSizes, "lg" | "md" | "sm" | "xs">;
    hideHoverStyles?: boolean;
    textSize?: ComponentProps<typeof Text>["size"];
    variant?: TVariant;
}
export declare const Button: ({ borderWidth, className, color, icon, isFullWidth, isLoading, rounded, size, hideHoverStyles, textSize, variant, ...rest }: ButtonProps) => import("react").JSX.Element;
export {};
