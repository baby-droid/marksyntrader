import { jsx } from "react/jsx-runtime";
import TextFieldAtom from "./index94.mjs";
const TextFieldGroupAddon = ({
  labelLeft = "Label",
  labelRight = "Label",
  icon,
  ...props
}) => {
  return /* @__PURE__ */ jsx(
    TextFieldAtom,
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
export {
  TextFieldGroupAddon,
  TextFieldGroupAddon as default
};
//# sourceMappingURL=index39.mjs.map
