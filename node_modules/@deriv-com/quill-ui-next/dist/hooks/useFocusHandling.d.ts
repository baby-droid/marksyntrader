type FocusHandlingConfig = {
    isDisabled?: boolean;
    onFocusExtra?: () => void;
    onBlurExtra?: () => void;
    setHighlight: (value: boolean) => void;
    onEnter?: () => void;
};
export declare const useFocusHandling: ({ isDisabled, onFocusExtra, onBlurExtra, setHighlight, onEnter, }: FocusHandlingConfig) => {
    handleFocus: () => void;
    handleBlur: () => void;
};
export {};
