"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const React = require("react");
const useClickOutside = (ref, callback, ignoredElements) => {
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      var _a, _b;
      const target = event.target;
      const isOverlayClick = ((_b = (_a = target == null ? void 0 : target.className) == null ? void 0 : _a.includes) == null ? void 0 : _b.call(_a, "quill-ui-next-overlay")) ?? false;
      const isInsideOverlay = (target == null ? void 0 : target.closest(".quill-ui-next-overlay")) !== null;
      if (ref.current && !ref.current.contains(target) && !isOverlayClick && !isInsideOverlay && !(ignoredElements == null ? void 0 : ignoredElements.some((element) => {
        var _a2, _b2;
        if ((_b2 = (_a2 = target == null ? void 0 : target.className) == null ? void 0 : _a2.includes) == null ? void 0 : _b2.call(_a2, element)) return true;
        if (typeof (target == null ? void 0 : target.closest) === "function") {
          const found = target.closest(`[class*="${element}"]`);
          if (found) return true;
        }
        return false;
      }))) {
        callback();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, callback]);
};
exports.useClickOutside = useClickOutside;
//# sourceMappingURL=index47.cjs.map
