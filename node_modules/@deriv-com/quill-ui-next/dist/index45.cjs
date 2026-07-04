"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const React = require("react");
const useKeyboardFocus = () => {
  const wasKeyboard = React.useRef(false);
  const timeoutRef = React.useRef(void 0);
  React.useEffect(() => {
    const handleKeyDown = () => {
      wasKeyboard.current = true;
    };
    const handleMouseDown = () => {
      clearTimeout(timeoutRef.current);
      wasKeyboard.current = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
      clearTimeout(timeoutRef.current);
    };
  }, []);
  return {
    wasKeyboard,
    onFocus: (callback) => {
      if (wasKeyboard.current && callback) {
        callback();
      }
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        wasKeyboard.current = false;
      }, 100);
    },
    onBlur: (callback) => {
      if (callback) {
        callback();
      }
    }
  };
};
exports.useKeyboardFocus = useKeyboardFocus;
//# sourceMappingURL=index45.cjs.map
