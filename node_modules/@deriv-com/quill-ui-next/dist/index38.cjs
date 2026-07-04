"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index94.cjs");
const index$1 = require("./index36.cjs");
const TextFieldGroupButton = ({
  id,
  name,
  label = "Label",
  iconLeft,
  iconRight,
  button,
  state,
  hideButton = false,
  indicator = "neutral",
  buttonPosition = "bottom",
  variant = "labelled",
  size = "lg",
  ...props
}) => {
  const buttonSize = variant === "labelled" || size === "lg" ? "md" : size;
  const [isFocused, setIsFocused] = React.useState(false);
  const Button = () => {
    return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: !hideButton && indicator !== "fail" && indicator !== "success" && /* @__PURE__ */ jsxRuntime.jsx(
      index$1.BasicButton,
      {
        state: !isFocused ? "disabled" : state,
        label: "Label",
        ...button,
        className: `quill-ui-next-textfield-button ${buttonPosition === "right" ? "right" : "bottom"} ${variant} ${size} ${button == null ? void 0 : button.className}`,
        size: buttonSize,
        style: "primary",
        width: buttonPosition === "right" ? "hug content" : "fill container",
        color: "blackWhite"
      }
    ) });
  };
  return /* @__PURE__ */ jsxRuntime.jsx(
    index,
    {
      id,
      name,
      ...props,
      size,
      variant,
      indicator,
      state,
      label,
      iconLeft,
      iconRight: indicator !== "fail" && indicator !== "success" && iconRight,
      contentRight: buttonPosition === "right" && /* @__PURE__ */ jsxRuntime.jsx(Button, {}),
      customInnerContent: buttonPosition === "bottom" && /* @__PURE__ */ jsxRuntime.jsx(Button, {}),
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false)
    }
  );
};
TextFieldGroupButton.displayName = "TextFieldGroupButton";
exports.TextFieldGroupButton = TextFieldGroupButton;
exports.default = TextFieldGroupButton;
//# sourceMappingURL=index38.cjs.map
