import { ComponentProps, ReactNode } from 'react';
import { Text } from '../Text';

type TItem = {
    value?: string | number;
    text: string | JSX.Element;
};
type BreadcrumbsProps = {
    className?: string;
    items: TItem[];
    handleOnClick: (item: TItem) => void;
    separator?: ReactNode;
    textSize?: ComponentProps<typeof Text>["size"];
};
export declare const Breadcrumbs: ({ className, items, handleOnClick, separator, textSize, }: BreadcrumbsProps) => import("react").JSX.Element;
export {};
