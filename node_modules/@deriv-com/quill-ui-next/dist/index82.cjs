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
const LabelPairedChevronRightMdRegularIcon = ({ title, titleId, ...props }, ref) => React__namespace.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", width: 10, height: 24, viewBox: "0 0 10 24", role: "img", ref, "aria-labelledby": titleId, ...props },
  title ? React__namespace.createElement("title", { id: titleId }, title) : null,
  React__namespace.createElement(
    "g",
    null,
    React__namespace.createElement("path", { d: "M9.344 11.656a.53.53 0 0 1 0 .719l-6 6a.53.53 0 0 1-.719 0 .53.53 0 0 1 0-.719L8.281 12 2.625 6.375a.53.53 0 0 1 0-.719.53.53 0 0 1 .719 0z" })
  ),
  React__namespace.createElement(
    "defs",
    null,
    React__namespace.createElement(
      "clipPath",
      { id: "de53659cc0751e42def721e02aaa5770__a" },
      React__namespace.createElement("path", { d: "M0 0h10v24H0z" })
    )
  )
);
const ForwardRef = React.forwardRef(LabelPairedChevronRightMdRegularIcon);
module.exports = ForwardRef;
//# sourceMappingURL=index82.cjs.map
