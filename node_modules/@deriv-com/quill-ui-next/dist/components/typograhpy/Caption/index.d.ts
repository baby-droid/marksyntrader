import { BaseTypographyType } from '../base';
export type CaptionType = Omit<BaseTypographyType, "type" | "level" | "size">;
declare const Caption: (props: CaptionType) => import("react/jsx-runtime").JSX.Element;
export default Caption;
