import { BaseTypographyType } from '../base';
export type CodeType = Omit<BaseTypographyType, "type" | "level"> & {
    /** Size for code text */
    size?: "sm" | "md" | "lg" | "xl";
};
declare const Code: ({ size, as, ...props }: CodeType) => import("react/jsx-runtime").JSX.Element;
export default Code;
