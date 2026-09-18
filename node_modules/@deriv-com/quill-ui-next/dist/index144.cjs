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
const LabelPairedLoaderLgRegularIcon = ({ title, titleId, ...props }, ref) => React__namespace.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", width: 20, height: 30, viewBox: "0 0 20 30", role: "img", ref, "aria-labelledby": titleId, ...props },
  title ? React__namespace.createElement("title", { id: titleId }, title) : null,
  React__namespace.createElement(
    "g",
    null,
    React__namespace.createElement("path", { d: "M10.625 6.125v3.75A.64.64 0 0 1 10 10.5a.617.617 0 0 1-.625-.625v-3.75c0-.312.273-.625.625-.625.313 0 .625.313.625.625m0 15v3.75A.64.64 0 0 1 10 25.5a.617.617 0 0 1-.625-.625v-3.75c0-.312.273-.625.625-.625.313 0 .625.313.625.625M0 15.5c0-.312.273-.625.625-.625h3.75c.313 0 .625.313.625.625a.64.64 0 0 1-.625.625H.625A.617.617 0 0 1 0 15.5m15.625-.625h3.75c.313 0 .625.313.625.625a.64.64 0 0 1-.625.625h-3.75A.617.617 0 0 1 15 15.5c0-.312.273-.625.625-.625M17.07 8.43c.235.273.235.664 0 .898l-2.656 2.656c-.273.235-.664.235-.898 0-.235-.234-.235-.625 0-.898l2.656-2.656c.234-.235.625-.235.898 0M6.445 19.953 3.79 22.57a.553.553 0 0 1-.86 0 .553.553 0 0 1 0-.86l2.618-2.655c.273-.235.664-.235.898 0 .235.234.235.625 0 .898M2.93 8.43a.613.613 0 0 1 .86 0l2.655 2.656c.235.273.235.664 0 .898-.234.235-.625.235-.898 0L2.93 9.328c-.274-.234-.274-.625 0-.898m11.484 10.625 2.656 2.656a.613.613 0 0 1 0 .86c-.273.273-.664.273-.898 0l-2.656-2.618c-.235-.273-.235-.664 0-.898.234-.235.625-.235.898 0" })
  ),
  React__namespace.createElement(
    "defs",
    null,
    React__namespace.createElement(
      "clipPath",
      { id: "b9d375456cddee61ea8993949fc9fce6__a" },
      React__namespace.createElement("path", { d: "M0 0h20v30H0z" })
    )
  )
);
const ForwardRef = React.forwardRef(LabelPairedLoaderLgRegularIcon);
module.exports = ForwardRef;
//# sourceMappingURL=index144.cjs.map
