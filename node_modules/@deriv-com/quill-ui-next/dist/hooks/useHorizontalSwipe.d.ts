interface UseHorizontalSwipeProps {
    threshold?: number;
    initialState?: boolean;
}
/**
 * A minimal hook for horizontal swipe detection
 *
 * @param threshold Minimum distance in pixels to trigger a swipe (default: 40)
 * @param initialState Initial state of the swipe (default: false)
 * @returns Object containing swipe state and handlers
 */
export declare const useHorizontalSwipe: ({ threshold, initialState, }?: UseHorizontalSwipeProps) => {
    isSwiped: boolean;
    resetSwipe: () => void;
    setIsSwiped: (state: boolean) => void;
    swipeHandlers: {
        onTouchStart: (e: React.TouchEvent) => void;
        onTouchMove: (e: React.TouchEvent) => void;
        onTouchEnd: (e: React.TouchEvent) => void;
        onMouseDown: (e: React.MouseEvent) => void;
        onMouseMove: (e: React.MouseEvent) => void;
        onMouseUp: (e: React.MouseEvent) => void;
        onMouseLeave: (e: React.MouseEvent) => void;
    };
};
export {};
