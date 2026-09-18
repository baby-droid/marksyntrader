/**
 * Hook to detect if an element is inside an action sheet container
 * @returns A function that checks if a target element is inside an action sheet container
 */
export declare const useActionSheetDetection: () => {
    isInsideActionSheet: (target: HTMLElement | null) => boolean;
};
export default useActionSheetDetection;
