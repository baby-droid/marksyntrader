"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const usePortalClick = (ref) => {
  const isPortalClick = (e) => {
    var _a;
    return !((_a = ref.current) == null ? void 0 : _a.contains(e.target));
  };
  return { isPortalClick };
};
exports.usePortalClick = usePortalClick;
//# sourceMappingURL=index52.cjs.map
