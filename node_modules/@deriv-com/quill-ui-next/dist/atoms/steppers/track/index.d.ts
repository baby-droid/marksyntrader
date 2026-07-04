import { FunctionComponent } from 'react';
export type SteppersTrackType = {
    className?: string;
    type?: "inactive" | "inprogress" | "hidden";
    direction?: "horizontal" | "vertical";
};
declare const SteppersTrackAtom: FunctionComponent<SteppersTrackType>;
export default SteppersTrackAtom;
