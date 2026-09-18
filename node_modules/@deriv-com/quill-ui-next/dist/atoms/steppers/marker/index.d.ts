import { FunctionComponent, ReactNode } from 'react';
export type SteppersMarketType = {
    className?: string;
    text?: number | string;
    size?: "sm" | "md" | "lg";
    type?: "inactive" | "inprogress" | "complete";
    marker?: "dot" | "number" | "icon";
    indicator?: "default" | "fail" | "warning";
    icon?: ReactNode;
};
declare const SteppersMarkerAtom: FunctionComponent<SteppersMarketType>;
export default SteppersMarkerAtom;
