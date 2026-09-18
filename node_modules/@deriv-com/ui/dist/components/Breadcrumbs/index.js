import '../../assets/Breadcrumbs.css';
import { jsx as a, jsxs as i } from "react/jsx-runtime";
import { c as d } from "../../clsx-OuTLNxxd.js";
import { Text as p } from "../Text/index.js";
/* empty css                         */
import * as m from "react";
import { forwardRef as b } from "react";
import { s as f } from "../../index-CQbz1p6_.js";
const u = ({ iconSize: s = "md", title: e, titleId: r, ...o }, l) => m.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 16 16", ...f[s], role: "img", ref: l, "aria-labelledby": r, ...o },
  e ? m.createElement("title", { id: r }, e) : null,
  m.createElement("path", { fill: "#333", fillRule: "evenodd", d: "M5.146 2.146a.5.5 0 0 1 .708 0l5.5 5.5a.5.5 0 0 1 0 .708l-5.5 5.5a.5.5 0 0 1-.708-.708L10.293 8 5.146 2.854a.5.5 0 0 1 0-.708", clipRule: "evenodd" })
), v = b(u), N = ({
  className: s,
  items: e,
  handleOnClick: r,
  separator: o,
  textSize: l = "sm"
}) => /* @__PURE__ */ a("ul", { className: d("deriv-breadcrumbs", s), children: e.map((c, n) => {
  const t = n === e.length - 1;
  return /* @__PURE__ */ i(
    "li",
    {
      className: "deriv-breadcrumbs__item",
      children: [
        /* @__PURE__ */ a(
          p,
          {
            className: "deriv-breadcrumbs__text",
            color: t ? "prominent" : "less-prominent",
            onClick: () => r(c),
            size: l,
            children: c.text
          }
        ),
        !t && /* @__PURE__ */ a("span", { className: "deriv-breadcrumbs__separator-container", children: o || /* @__PURE__ */ a(
          v,
          {
            className: "deriv-breadcrumbs__chevron-icon",
            iconSize: "xs"
          }
        ) })
      ]
    },
    c.value ?? n
  );
}) });
export {
  N as Breadcrumbs
};
