import { FunctionComponent, ReactNode } from 'react';
export type TagType = {
    className?: string;
    label: string;
    fontWeight?: "regular" | "bold";
    size?: "sm" | "xs" | "md" | "lg";
    state?: "custom" | "danger" | "warning" | "success" | "information";
    style?: "fill" | "outline";
    icon?: ReactNode;
};
export declare const Tag: FunctionComponent<TagType>;
export default Tag;
