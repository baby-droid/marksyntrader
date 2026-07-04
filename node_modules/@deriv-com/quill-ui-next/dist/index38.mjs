import { jsx, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import TextFieldAtom from "./index94.mjs";
import { BasicButton } from "./index36.mjs";
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
  const [isFocused, setIsFocused] = useState(false);
  const Button = () => {
    return /* @__PURE__ */ jsx(Fragment, { children: !hideButton && indicator !== "fail" && indicator !== "success" && /* @__PURE__ */ jsx(
      BasicButton,
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
  return /* @__PURE__ */ jsx(
    TextFieldAtom,
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
      contentRight: buttonPosition === "right" && /* @__PURE__ */ jsx(Button, {}),
      customInnerContent: buttonPosition === "bottom" && /* @__PURE__ */ jsx(Button, {}),
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false)
    }
  );
};
TextFieldGroupButton.displayName = "TextFieldGroupButton";
export {
  TextFieldGroupButton,
  TextFieldGroupButton as default
};
//# sourceMappingURL=index38.mjs.map
