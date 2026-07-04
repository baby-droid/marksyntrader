import { ComponentProps, ReactNode } from 'react';

interface CheckboxProps extends Omit<ComponentProps<"input">, "placeholder" | "defaultChecked" | "name"> {
    name: string;
    error?: boolean;
    label?: ReactNode;
    labelClassName?: string;
    wrapperClassName?: string;
}
export declare const Checkbox: import('react').ForwardRefExoticComponent<Omit<CheckboxProps, "ref"> & import('react').RefAttributes<HTMLInputElement>>;
export {};
