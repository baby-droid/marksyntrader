interface UseDragToCloseProps {
    isEnabled: boolean;
    onClose?: () => void;
    threshold?: number;
}
interface UseDragToCloseResult {
    dragHandlers: {
        onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
        onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
        onTouchEnd: () => void;
    };
    dragStyles: {
        transform: string | undefined;
        transition: string | undefined;
    };
}
/**
 * A hook that provides drag-to-close functionality for bottom sheets and modals
 *
 * @param isEnabled Whether the drag functionality is enabled
 * @param onClose Function to call when the drag threshold is exceeded
 * @param threshold Distance in pixels that triggers the close action (default: 150)
 * @returns Object containing drag handlers and styles to apply to the component
 */
export declare const useDragToClose: ({ isEnabled, onClose, threshold, }: UseDragToCloseProps) => UseDragToCloseResult;
export {};
