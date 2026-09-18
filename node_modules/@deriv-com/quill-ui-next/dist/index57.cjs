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
const LabelPairedCircleInfoSmRegularIcon = ({ title, titleId, ...props }, ref) => React__namespace.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", width: 14, height: 22, viewBox: "0 0 14 22", role: "img", ref, "aria-labelledby": titleId, ...props },
  title ? React__namespace.createElement("title", { id: titleId }, title) : null,
  React__namespace.createElement(
    "g",
    null,
    React__namespace.createElement("path", { d: "M7 4.625a6.11 6.11 0 0 0-5.305 3.063c-1.12 1.914-1.12 4.238 0 6.125C2.79 15.727 4.785 16.875 7 16.875a6.04 6.04 0 0 0 5.277-3.062c1.121-1.887 1.121-4.211 0-6.126A6.1 6.1 0 0 0 7 4.626M7 17.75a6.96 6.96 0 0 1-6.07-3.5c-1.258-2.16-1.258-4.812 0-7A7.02 7.02 0 0 1 7 3.75c2.488 0 4.785 1.34 6.043 3.5 1.258 2.188 1.258 4.84 0 7A6.95 6.95 0 0 1 7 17.75m-1.312-4.375h.875V10.75h-.657a.43.43 0 0 1-.437-.437.45.45 0 0 1 .437-.438H7a.47.47 0 0 1 .438.438v3.062h.875a.47.47 0 0 1 .437.438.45.45 0 0 1-.437.437H5.687a.43.43 0 0 1-.437-.437.45.45 0 0 1 .438-.438M7 8.781a.63.63 0 0 1-.656-.656c0-.355.273-.656.656-.656.355 0 .656.3.656.656 0 .383-.3.656-.656.656" })
  ),
  React__namespace.createElement(
    "defs",
    null,
    React__namespace.createElement(
      "clipPath",
      { id: "1d5629c3fe715ba6306a2189946e22e1__a" },
      React__namespace.createElement("path", { d: "M0 0h14v22H0z" })
    )
  )
);
const ForwardRef = React.forwardRef(LabelPairedCircleInfoSmRegularIcon);
module.exports = ForwardRef;
//# sourceMappingURL=index57.cjs.map
