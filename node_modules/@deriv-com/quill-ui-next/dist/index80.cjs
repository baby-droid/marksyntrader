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
const LabelPairedChevronRightXlRegularIcon = ({ title, titleId, ...props }, ref) => React__namespace.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", width: 15, height: 36, viewBox: "0 0 15 36", role: "img", ref, "aria-labelledby": titleId, ...props },
  title ? React__namespace.createElement("title", { id: titleId }, title) : null,
  React__namespace.createElement(
    "g",
    null,
    React__namespace.createElement("path", { d: "M14.016 17.484c.28.282.28.797 0 1.078l-9 9c-.282.282-.797.282-1.078 0-.282-.28-.282-.796 0-1.078L12.422 18 3.938 9.563c-.282-.282-.282-.797 0-1.079.28-.28.796-.28 1.078 0z" })
  ),
  React__namespace.createElement(
    "defs",
    null,
    React__namespace.createElement(
      "clipPath",
      { id: "ab8696625cef89b93034dd99bc87e225__a" },
      React__namespace.createElement("path", { d: "M0 0h15v36H0z" })
    )
  )
);
const ForwardRef = React.forwardRef(LabelPairedChevronRightXlRegularIcon);
module.exports = ForwardRef;
//# sourceMappingURL=index80.cjs.map
