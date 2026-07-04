import { FunctionComponent, ReactNode } from 'react';
export type SteppersLabelContentType = {
    className?: string;
    label?: string;
    description?: ReactNode;
    size?: "sm" | "md" | "lg";
    type?: "incomplete" | "inprogress" | "complete";
    direction?: "vertical" | "horizontal";
};
declare const SteppersLabelContentAtom: FunctionComponent<SteppersLabelContentType>;
export default SteppersLabelContentAtom;
