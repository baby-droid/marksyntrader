import { default as React } from 'react';
export type PaginationVariant = "number" | "bullet";
export interface PaginationProps<T> {
    data: T[];
    itemsPerPage?: number;
    currentPage?: number;
    defaultPage?: number;
    onPageChange?: (page: number) => void;
    variant?: PaginationVariant;
    renderItem: (item: T, index: number) => React.ReactNode;
    className?: string;
    itemsClassName?: string;
}
export declare const Pagination: {
    <T>({ data, itemsPerPage, currentPage, defaultPage, onPageChange, variant, renderItem, className, itemsClassName, }: PaginationProps<T>): import("react/jsx-runtime").JSX.Element;
    displayName: string;
};
export default Pagination;
