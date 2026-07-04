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
const LabelPairedChevronRightSmRegularIcon = ({ title, titleId, ...props }, ref) => React__namespace.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", width: 9, height: 22, viewBox: "0 0 9 22", role: "img", ref, "aria-labelledby": titleId, ...props },
  title ? React__namespace.createElement("title", { id: titleId }, title) : null,
  React__namespace.createElement(
    "g",
    null,
    React__namespace.createElement("path", { d: "M8.3 10.45a.463.463 0 0 1 0 .628l-5.25 5.25a.463.463 0 0 1-.628 0 .463.463 0 0 1 0-.629l4.95-4.949-4.95-4.922a.463.463 0 0 1 0-.629.463.463 0 0 1 .629 0z" })
  ),
  React__namespace.createElement(
    "defs",
    null,
    React__namespace.createElement(
      "clipPath",
      { id: "868a53708ec5a84998bbca257b0182d5__a" },
      React__namespace.createElement("path", { d: "M0 0h9v22H0z" })
    )
  )
);
const ForwardRef = React.forwardRef(LabelPairedChevronRightSmRegularIcon);
module.exports = ForwardRef;
//# sourceMappingURL=index83.cjs.map
