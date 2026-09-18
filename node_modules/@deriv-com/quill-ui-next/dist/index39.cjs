"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const index = require("./index94.cjs");
const TextFieldGroupAddon = ({
  labelLeft = "Label",
  labelRight = "Label",
  icon,
  ...props
}) => {
  return /* @__PURE__ */ jsxRuntime.jsx(
    index,
    {
      ...props,
      labelLeft,
      labelRight,
      iconRight: icon,
      isGroup: true
    }
  );
};
TextFieldGroupAddon.displayName = "TextFieldGroupAddon";
exports.TextFieldGroupAddon = TextFieldGroupAddon;
exports.default = TextFieldGroupAddon;
//# sourceMappingURL=index39.cjs.map
