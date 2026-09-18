"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const React = require("react");
const useActionSheetDetection = () => {
  const isInsideActionSheet = React.useCallback((target) => {
    if (!target) return false;
    return !!target.closest(".quill-ui-next-actionsheet-full-width");
  }, []);
  return { isInsideActionSheet };
};
exports.default = useActionSheetDetection;
exports.useActionSheetDetection = useActionSheetDetection;
//# sourceMappingURL=index50.cjs.map
