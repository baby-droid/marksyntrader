import { default as React } from 'react';
import { ColumnDef } from '@tanstack/react-table';

type TProps<T> = {
    columns?: ColumnDef<T>[];
    data: T[];
    emptyDataMessage?: string;
    loadMoreFunction: () => void;
    renderHeader?: (data: string) => JSX.Element;
    rowRender: (data: T) => JSX.Element;
    tableClassname?: string;
};
export declare const Table: <T>({ columns, data, emptyDataMessage, loadMoreFunction, renderHeader, rowRender, tableClassname, }: TProps<T>) => React.JSX.Element;
export {};
