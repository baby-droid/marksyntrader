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
const LabelPairedCircleExclamationSmBoldIcon = ({ title, titleId, ...props }, ref) => React__namespace.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", width: 14, height: 22, viewBox: "0 0 14 22", role: "img", ref, "aria-labelledby": titleId, ...props },
  title ? React__namespace.createElement("title", { id: titleId }, title) : null,
  React__namespace.createElement(
    "g",
    null,
    React__namespace.createElement("path", { d: "M7 5.063c-2.05 0-3.91 1.093-4.95 2.843a5.71 5.71 0 0 0 0 5.688A5.7 5.7 0 0 0 7 16.438a5.68 5.68 0 0 0 4.922-2.844 5.71 5.71 0 0 0 0-5.688C10.882 6.156 9.023 5.063 7 5.063M7 17.75a6.96 6.96 0 0 1-6.07-3.5c-1.258-2.16-1.258-4.812 0-7A7.02 7.02 0 0 1 7 3.75c2.488 0 4.785 1.34 6.043 3.5 1.258 2.188 1.258 4.84 0 7A6.95 6.95 0 0 1 7 17.75m0-10.5c.355 0 .656.3.656.656v3.063c0 .383-.3.656-.656.656a.63.63 0 0 1-.656-.656V7.906c0-.355.273-.656.656-.656m.875 6.125c0 .492-.41.875-.875.875a.864.864 0 0 1-.875-.875c0-.465.383-.875.875-.875a.9.9 0 0 1 .875.875" })
  ),
  React__namespace.createElement(
    "defs",
    null,
    React__namespace.createElement(
      "clipPath",
      { id: "e7f27b1f9aa9aea0007e616e45cc63e8__a" },
      React__namespace.createElement("path", { d: "M0 0h14v22H0z" })
    )
  )
);
const ForwardRef = React.forwardRef(LabelPairedCircleExclamationSmBoldIcon);
module.exports = ForwardRef;
//# sourceMappingURL=index62.cjs.map
