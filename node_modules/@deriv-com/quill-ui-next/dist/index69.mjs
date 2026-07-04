import { jsxs, jsx } from "react/jsx-runtime";
import labelContentVertical from "./index128.mjs";
import labelContentHorizontal from "./index129.mjs";
const labelContentStyles = {
  vertical: labelContentVertical,
  horizontal: labelContentHorizontal
};
const SteppersLabelContentAtom = ({
  className = "",
  size = "sm",
  type = "incomplete",
  label = "Label",
  description,
  direction = "vertical"
}) => {
  const styles = labelContentStyles[direction];
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [styles.root, className, "quill-ui-next-atom"].join(" "),
      "data-size": size,
      "data-type": type,
      children: [
        /* @__PURE__ */ jsx("b", { className: styles.label, children: label }),
        description && /* @__PURE__ */ jsx("div", { className: styles.description, children: description })
      ]
    }
  );
};
export {
  SteppersLabelContentAtom as default
};
//# sourceMappingURL=index69.mjs.map
