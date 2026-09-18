import { jsx } from "react/jsx-runtime";
import BaseButton from "./index116.mjs";
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
  return /* @__PURE__ */ jsx(
    BaseButton,
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
export {
  BasicButton,
  BasicButton as default
};
//# sourceMappingURL=index36.mjs.map
