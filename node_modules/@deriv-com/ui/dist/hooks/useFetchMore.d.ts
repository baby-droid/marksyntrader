import { RefObject } from 'react';

type TProps = {
    loadMore: () => void;
    ref: RefObject<HTMLDivElement>;
};
/** A custom hook to load more items in the table on scroll to bottom of the table */
export declare const useFetchMore: ({ loadMore, ref }: TProps) => {
    fetchMoreOnBottomReached: (containerRefElement?: HTMLDivElement | null) => void;
};
export {};
