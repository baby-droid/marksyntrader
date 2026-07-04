import { jsx } from "react/jsx-runtime";
import BaseButton from "./index116.mjs";
const IconButton = ({
  className = "",
  icon,
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
      icon,
      size,
      state,
      style,
      width,
      onClick,
      color,
      type: "icon"
    }
  );
};
IconButton.displayName = "IconButton";
export {
  IconButton,
  IconButton as default
};
//# sourceMappingURL=index35.mjs.map
