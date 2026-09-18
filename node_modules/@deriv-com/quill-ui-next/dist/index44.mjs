import React__default, { useCallback } from "react";
import { useKeyboardFocus } from "./index45.mjs";
const useFocusHandling = ({
  isDisabled = false,
  onFocusExtra,
  onBlurExtra,
  setHighlight,
  onEnter
}) => {
  const { onFocus: keyboardFocus, onBlur: keyboardBlur } = useKeyboardFocus();
  const highlightRef = React__default.useRef(false);
  const handleFocus = useCallback(() => {
    if (!isDisabled) {
      keyboardFocus(() => {
        setHighlight(true);
        highlightRef.current = true;
        onFocusExtra == null ? void 0 : onFocusExtra();
      });
    }
  }, [isDisabled, keyboardFocus, setHighlight, onFocusExtra]);
  const handleBlur = useCallback(() => {
    if (!isDisabled) {
      keyboardBlur(() => {
        setHighlight(false);
        highlightRef.current = false;
        onBlurExtra == null ? void 0 : onBlurExtra();
      });
    }
  }, [isDisabled, keyboardBlur, setHighlight, onBlurExtra]);
  React__default.useEffect(() => {
    if (isDisabled || !onEnter) return;
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && highlightRef.current) {
        onEnter();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDisabled, onEnter]);
  return {
    handleFocus,
    handleBlur
  };
};
export {
  useFocusHandling
};
//# sourceMappingURL=index44.mjs.map
