"use strict";
const jsxRuntime = require("react/jsx-runtime");
const DropdownTitleAtom_module = require("./index165.cjs");
const DropdownTitleAtom = ({
  className = "",
  title,
  iconLeft,
  iconRight
}) => {
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: [DropdownTitleAtom_module.default.title, className, "quill-ui-next-atom"].join(" "), children: [
    iconLeft && /* @__PURE__ */ jsxRuntime.jsx("div", { className: DropdownTitleAtom_module.default.iconLeft, children: iconLeft }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: DropdownTitleAtom_module.default.title1, children: title }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: DropdownTitleAtom_module.default.containerIconRight, children: iconRight && /* @__PURE__ */ jsxRuntime.jsx("div", { className: DropdownTitleAtom_module.default.iconRight, children: iconLeft }) })
  ] });
};
module.exports = DropdownTitleAtom;
//# sourceMappingURL=index140.cjs.map
