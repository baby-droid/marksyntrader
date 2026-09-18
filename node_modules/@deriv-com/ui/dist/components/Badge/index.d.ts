import { ComponentProps, ReactElement, ReactNode } from 'react';
import { TGenericSizes } from '../../types';
import { Text } from '../Text';

type TVariant = "contained" | "bordered";
type TColor = "blue" | "blue-secondary" | "light-blue" | "general" | "purple" | "success" | "success-secondary" | "warning" | "warning-secondary" | "danger" | "danger-secondary" | "gold" | "green";
type TPadding = "tight" | "loose";
interface BadgeProps extends ComponentProps<"div"> {
    badgeSize?: Extract<TGenericSizes, "lg" | "md" | "sm" | "xs">;
    children: ReactNode;
    color?: TColor;
    isBold?: boolean;
    rightIcon?: ReactElement;
    leftIcon?: ReactElement;
    padding?: TPadding;
    rounded?: Extract<TGenericSizes, "lg" | "md" | "sm">;
    textSize?: ComponentProps<typeof Text>["size"];
    variant?: TVariant;
}
export declare const Badge: import('react').ForwardRefExoticComponent<Omit<BadgeProps, "ref"> & import('react').RefAttributes<HTMLDivElement>>;
export {};
