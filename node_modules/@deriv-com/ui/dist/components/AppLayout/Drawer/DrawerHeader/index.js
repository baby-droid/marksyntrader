import '../../../../assets/index26.css';
import { jsxs as t, jsx as s } from "react/jsx-runtime";
import { c as i } from "../../../../clsx-OuTLNxxd.js";
import * as d from "react";
import { forwardRef as c } from "react";
import { s as m } from "../../../../index-CQbz1p6_.js";
const n = ({ iconSize: a = "md", title: e, titleId: r, ...o }, l) => d.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 16 16", ...m[a], role: "img", ref: l, "aria-labelledby": r, ...o },
  e ? d.createElement("title", { id: r }, e) : null,
  d.createElement("path", { fill: "#333", d: "M2.293 3.707a1 1 0 0 1 1.414-1.414L8 6.586l4.293-4.293a1 1 0 1 1 1.414 1.414L9.414 8l4.293 4.293a1 1 0 0 1-1.414 1.414L8 9.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L6.586 8z" })
), w = c(n), f = ({
  onCloseDrawer: a,
  children: e,
  className: r,
  wrapperClassName: o,
  ...l
}) => /* @__PURE__ */ t(
  "div",
  {
    className: i("deriv-drawer__header", o),
    ...l,
    children: [
      /* @__PURE__ */ s(
        "div",
        {
          role: "drawer-close-button",
          className: "deriv-drawer__header__close-btn",
          onClick: a,
          children: /* @__PURE__ */ s(w, { iconSize: "xs" })
        }
      ),
      /* @__PURE__ */ s("div", { className: i("deriv-drawer__header__content", r), children: e })
    ]
  }
);
f.displayName = "DrawerHeader";
export {
  f as DrawerHeader
};
