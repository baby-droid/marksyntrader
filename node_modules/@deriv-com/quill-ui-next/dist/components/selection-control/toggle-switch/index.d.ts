interface ToggleSwitchProps {
    selected?: "off" | "on";
    state?: "default" | "disabled";
    onChange?: (selected: "off" | "on") => void;
    className?: string;
}
export declare const ToggleSwitch: ({ className, selected: externalSelected, state, onChange, }: ToggleSwitchProps) => import("react/jsx-runtime").JSX.Element;
export {};
