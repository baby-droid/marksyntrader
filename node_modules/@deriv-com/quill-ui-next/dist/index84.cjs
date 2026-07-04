"use strict";
const React = require("react");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const React__namespace = /* @__PURE__ */ _interopNamespaceDefault(React);
const LabelPairedChevronRightCaptionRegularIcon = ({ title, titleId, ...props }, ref) => React__namespace.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", width: 8, height: 18, viewBox: "0 0 8 18", role: "img", ref, "aria-labelledby": titleId, ...props },
  title ? React__namespace.createElement("title", { id: titleId }, title) : null,
  React__namespace.createElement(
    "g",
    null,
    React__namespace.createElement("path", { d: "M7.258 9.242c.14.14.14.399 0 .54l-4.5 4.5a.397.397 0 0 1-.54 0 .397.397 0 0 1 0-.54L6.462 9.5 2.219 5.281a.397.397 0 0 1 0-.539c.14-.14.398-.14.539 0z" })
  ),
  React__namespace.createElement(
    "defs",
    null,
    React__namespace.createElement(
      "clipPath",
      { id: "456734bce88d5f24f7aef12f90604109__a" },
      React__namespace.createElement("path", { d: "M0 0h8v18H0z" })
    )
  )
);
const ForwardRef = React.forwardRef(LabelPairedChevronRightCaptionRegularIcon);
module.exports = ForwardRef;
//# sourceMappingURL=index84.cjs.map
