import { BaseTypographyType } from '../base';
export type TextType = Omit<BaseTypographyType, "type" | "level"> & {
    /** Size for body text */
    size?: "sm" | "md" | "lg" | "xl";
};
declare const Text: ({ size, ...props }: TextType) => import("react/jsx-runtime").JSX.Element;
export default Text;
