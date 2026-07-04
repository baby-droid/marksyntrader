import { FunctionComponent, ReactNode } from 'react';
export type SteppersType = {
    className?: string;
    direction?: "horizontal" | "vertical";
    steps: {
        label?: string;
        description?: string;
        indicator?: "default" | "fail" | "warning";
        type?: "inactive" | "inprogress" | "complete";
        icon?: ReactNode;
    }[];
    marker?: "icon" | "number" | "dot";
    size?: "sm" | "md" | "lg";
    onClick?: (step: SteppersType["steps"][number]) => void;
};
export declare const Steppers: FunctionComponent<SteppersType>;
export default Steppers;
