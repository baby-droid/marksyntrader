import { useRef, useEffect } from "react";
const useKeyboardFocus = () => {
  const wasKeyboard = useRef(false);
  const timeoutRef = useRef(void 0);
  useEffect(() => {
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
export {
  useKeyboardFocus
};
//# sourceMappingURL=index45.mjs.map
