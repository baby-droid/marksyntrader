import * as React from "react";
import { forwardRef } from "react";
const LabelPairedChevronRightXlRegularIcon = ({ title, titleId, ...props }, ref) => React.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", width: 15, height: 36, viewBox: "0 0 15 36", role: "img", ref, "aria-labelledby": titleId, ...props },
  title ? React.createElement("title", { id: titleId }, title) : null,
  React.createElement(
    "g",
    null,
    React.createElement("path", { d: "M14.016 17.484c.28.282.28.797 0 1.078l-9 9c-.282.282-.797.282-1.078 0-.282-.28-.282-.796 0-1.078L12.422 18 3.938 9.563c-.282-.282-.282-.797 0-1.079.28-.28.796-.28 1.078 0z" })
  ),
  React.createElement(
    "defs",
    null,
    React.createElement(
      "clipPath",
      { id: "ab8696625cef89b93034dd99bc87e225__a" },
      React.createElement("path", { d: "M0 0h15v36H0z" })
    )
  )
);
const ForwardRef = forwardRef(LabelPairedChevronRightXlRegularIcon);
export {
  ForwardRef as default
};
//# sourceMappingURL=index80.mjs.map
