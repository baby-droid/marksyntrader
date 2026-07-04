import { default as React, ChangeEvent } from 'react';
import { Input } from '../Input';

interface ToggleSwitchProps {
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    value?: boolean;
    wrapperClassName?: React.ComponentProps<typeof Input>["wrapperClassName"];
    className?: React.ComponentProps<typeof Input>["className"];
    wrapperStyle?: React.CSSProperties;
    style?: React.CSSProperties;
}
export declare const ToggleSwitch: React.ForwardRefExoticComponent<ToggleSwitchProps & React.RefAttributes<HTMLInputElement>>;
export {};
