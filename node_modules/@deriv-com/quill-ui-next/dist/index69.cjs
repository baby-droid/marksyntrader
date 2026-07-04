"use strict";
const jsxRuntime = require("react/jsx-runtime");
const SteppersLabelContentVertical_module = require("./index128.cjs");
const SteppersLabelContentHorizontal_module = require("./index129.cjs");
const labelContentStyles = {
  vertical: SteppersLabelContentVertical_module.default,
  horizontal: SteppersLabelContentHorizontal_module.default
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
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [styles.root, className, "quill-ui-next-atom"].join(" "),
      "data-size": size,
      "data-type": type,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("b", { className: styles.label, children: label }),
        description && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.description, children: description })
      ]
    }
  );
};
module.exports = SteppersLabelContentAtom;
//# sourceMappingURL=index69.cjs.map
