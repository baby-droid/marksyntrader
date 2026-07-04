"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const hasInputValue = (value) => {
  if (typeof value === "string") return value.length > 0;
  if (typeof value === "number") return true;
  return false;
};
exports.hasInputValue = hasInputValue;
//# sourceMappingURL=index109.cjs.map
