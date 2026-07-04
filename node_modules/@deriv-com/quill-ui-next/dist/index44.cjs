"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const React = require("react");
const useKeyboardFocus = require("./index45.cjs");
const useFocusHandling = ({
  isDisabled = false,
  onFocusExtra,
  onBlurExtra,
  setHighlight,
  onEnter
}) => {
  const { onFocus: keyboardFocus, onBlur: keyboardBlur } = useKeyboardFocus.useKeyboardFocus();
  const highlightRef = React.useRef(false);
  const handleFocus = React.useCallback(() => {
    if (!isDisabled) {
      keyboardFocus(() => {
        setHighlight(true);
        highlightRef.current = true;
        onFocusExtra == null ? void 0 : onFocusExtra();
      });
    }
  }, [isDisabled, keyboardFocus, setHighlight, onFocusExtra]);
  const handleBlur = React.useCallback(() => {
    if (!isDisabled) {
      keyboardBlur(() => {
        setHighlight(false);
        highlightRef.current = false;
        onBlurExtra == null ? void 0 : onBlurExtra();
      });
    }
  }, [isDisabled, keyboardBlur, setHighlight, onBlurExtra]);
  React.useEffect(() => {
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
exports.useFocusHandling = useFocusHandling;
//# sourceMappingURL=index44.cjs.map
