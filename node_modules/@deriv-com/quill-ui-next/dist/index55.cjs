"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const React = require("react");
const useKeyboardAction = (action) => {
  const handleKeyDown = React.useCallback(
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
exports.useKeyboardAction = useKeyboardAction;
//# sourceMappingURL=index55.cjs.map
