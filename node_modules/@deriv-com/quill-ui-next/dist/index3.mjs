import { jsx, jsxs } from "react/jsx-runtime";
import styles from "./index56.mjs";
import ForwardRef from "./index57.mjs";
import ForwardRef$1 from "./index58.mjs";
import ForwardRef$2 from "./index59.mjs";
import ForwardRef$3 from "./index60.mjs";
import ForwardRef$4 from "./index61.mjs";
import ForwardRef$5 from "./index62.mjs";
import ForwardRef$6 from "./index63.mjs";
import ForwardRef$7 from "./index64.mjs";
const stateIcons = {
  danger: {
    bold: /* @__PURE__ */ jsx(ForwardRef$7, {}),
    regular: /* @__PURE__ */ jsx(ForwardRef$6, {})
  },
  warning: {
    bold: /* @__PURE__ */ jsx(ForwardRef$5, {}),
    regular: /* @__PURE__ */ jsx(ForwardRef$4, {})
  },
  success: {
    bold: /* @__PURE__ */ jsx(ForwardRef$3, {}),
    regular: /* @__PURE__ */ jsx(ForwardRef$2, {})
  },
  information: {
    bold: /* @__PURE__ */ jsx(ForwardRef$1, {}),
    regular: /* @__PURE__ */ jsx(ForwardRef, {})
  }
};
const Tag = ({
  className = "",
  fontWeight = "regular",
  size = "sm",
  state = "custom",
  style = "fill",
  label,
  icon
}) => {
  var _a;
  const stateIcon = state !== "custom" ? (_a = stateIcons[state]) == null ? void 0 : _a[fontWeight] : icon;
  const tagId = `quill-tag-${state}`;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [styles.root, className, "quill-ui-next-component"].join(" "),
      "data-id": tagId,
      "data-fontWeight": fontWeight,
      "data-size": size,
      "data-state": state,
      "data-style": style,
      children: [
        stateIcon,
        /* @__PURE__ */ jsx("span", { className: styles.label, children: label === "" ? "Label" : label })
      ]
    }
  );
};
Tag.displayName = "Tag";
export {
  Tag,
  Tag as default
};
//# sourceMappingURL=index3.mjs.map
