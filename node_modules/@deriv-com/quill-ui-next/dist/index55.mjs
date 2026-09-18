import { useCallback } from "react";
const useKeyboardAction = (action) => {
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        action();
      }
    },
    [action]
  );
  return handleKeyDown;
};
export {
  useKeyboardAction
};
//# sourceMappingURL=index55.mjs.map
