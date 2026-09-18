import * as React from "react";
import { forwardRef } from "react";
const LabelPairedChevronRightSmRegularIcon = ({ title, titleId, ...props }, ref) => React.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", width: 9, height: 22, viewBox: "0 0 9 22", role: "img", ref, "aria-labelledby": titleId, ...props },
  title ? React.createElement("title", { id: titleId }, title) : null,
  React.createElement(
    "g",
    null,
    React.createElement("path", { d: "M8.3 10.45a.463.463 0 0 1 0 .628l-5.25 5.25a.463.463 0 0 1-.628 0 .463.463 0 0 1 0-.629l4.95-4.949-4.95-4.922a.463.463 0 0 1 0-.629.463.463 0 0 1 .629 0z" })
  ),
  React.createElement(
    "defs",
    null,
    React.createElement(
      "clipPath",
      { id: "868a53708ec5a84998bbca257b0182d5__a" },
      React.createElement("path", { d: "M0 0h9v22H0z" })
    )
  )
);
const ForwardRef = forwardRef(LabelPairedChevronRightSmRegularIcon);
export {
  ForwardRef as default
};
//# sourceMappingURL=index83.mjs.map
