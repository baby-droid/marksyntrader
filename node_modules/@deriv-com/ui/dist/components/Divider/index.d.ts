import { CSSProperties } from 'react';

type DividerProps = {
    color?: string;
    margin?: CSSProperties["margin"];
    height?: CSSProperties["height"];
    className?: HTMLDivElement["className"];
};
export declare const Divider: ({ color, height, margin, className, }: DividerProps) => import("react").JSX.Element;
export {};
