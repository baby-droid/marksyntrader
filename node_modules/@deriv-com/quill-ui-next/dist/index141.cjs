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
const LabelPairedLoaderCaptionRegularIcon = ({ title, titleId, ...props }, ref) => React__namespace.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", width: 12, height: 18, viewBox: "0 0 12 18", role: "img", ref, "aria-labelledby": titleId, ...props },
  title ? React__namespace.createElement("title", { id: titleId }, title) : null,
  React__namespace.createElement(
    "g",
    null,
    React__namespace.createElement("path", { d: "M6.375 3.875v2.25c0 .21-.187.375-.375.375a.37.37 0 0 1-.375-.375v-2.25c0-.187.164-.375.375-.375.188 0 .375.188.375.375m0 9v2.25c0 .21-.187.375-.375.375a.37.37 0 0 1-.375-.375v-2.25c0-.187.164-.375.375-.375.188 0 .375.188.375.375M0 9.5c0-.187.164-.375.375-.375h2.25c.188 0 .375.188.375.375 0 .21-.187.375-.375.375H.375A.37.37 0 0 1 0 9.5m9.375-.375h2.25c.188 0 .375.188.375.375 0 .21-.187.375-.375.375h-2.25A.37.37 0 0 1 9 9.5c0-.187.164-.375.375-.375m.867-3.867c.14.164.14.398 0 .539L8.648 7.39c-.164.14-.398.14-.539 0-.14-.141-.14-.375 0-.54l1.594-1.593c.14-.14.375-.14.54 0m-6.375 6.914-1.594 1.57a.332.332 0 0 1-.515 0 .332.332 0 0 1 0-.515l1.57-1.594c.164-.14.399-.14.54 0 .14.14.14.375 0 .539m-2.11-6.914c.141-.14.376-.14.516 0l1.594 1.594c.14.164.14.398 0 .539-.14.14-.375.14-.539 0l-1.57-1.594c-.164-.14-.164-.375 0-.54m6.891 6.375 1.594 1.594c.14.14.14.375 0 .515-.164.164-.398.164-.539 0l-1.594-1.57c-.14-.164-.14-.399 0-.54.141-.14.375-.14.54 0" })
  ),
  React__namespace.createElement(
    "defs",
    null,
    React__namespace.createElement(
      "clipPath",
      { id: "1d73502a283088e0ac1ac1eb030d8292__a" },
      React__namespace.createElement("path", { d: "M0 0h12v18H0z" })
    )
  )
);
const ForwardRef = React.forwardRef(LabelPairedLoaderCaptionRegularIcon);
module.exports = ForwardRef;
//# sourceMappingURL=index141.cjs.map
