"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const index = require("./index116.cjs");
const BasicButton = ({
  className = "",
  label,
  iconLeft,
  iconRight,
  size = "md",
  state = "default",
  style = "primary",
  width = "hug content",
  color = "coral",
  onClick
}) => {
  return /* @__PURE__ */ jsxRuntime.jsx(
    index,
    {
      className,
      label,
      iconLeft,
      iconRight,
      size,
      state,
      style,
      width,
      onClick,
      color
    }
  );
};
BasicButton.displayName = "BasicButton";
exports.BasicButton = BasicButton;
exports.default = BasicButton;
//# sourceMappingURL=index36.cjs.map
