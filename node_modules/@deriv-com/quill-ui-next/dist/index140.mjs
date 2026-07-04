import { jsxs, jsx } from "react/jsx-runtime";
import styles from "./index165.mjs";
const DropdownTitleAtom = ({
  className = "",
  title,
  iconLeft,
  iconRight
}) => {
  return /* @__PURE__ */ jsxs("div", { className: [styles.title, className, "quill-ui-next-atom"].join(" "), children: [
    iconLeft && /* @__PURE__ */ jsx("div", { className: styles.iconLeft, children: iconLeft }),
    /* @__PURE__ */ jsx("div", { className: styles.title1, children: title }),
    /* @__PURE__ */ jsx("div", { className: styles.containerIconRight, children: iconRight && /* @__PURE__ */ jsx("div", { className: styles.iconRight, children: iconLeft }) })
  ] });
};
export {
  DropdownTitleAtom as default
};
//# sourceMappingURL=index140.mjs.map
