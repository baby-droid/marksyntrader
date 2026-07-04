import '../../assets/index.css';
import { jsxs as c, jsx as o } from "react/jsx-runtime";
import { c as v } from "../../clsx-OuTLNxxd.js";
import { Loader as h } from "../Loader/index.js";
import { Text as p } from "../Text/index.js";
const f = {
  contained: "deriv-button__variant--contained",
  ghost: "deriv-button__variant--ghost",
  outlined: "deriv-button__variant--outlined"
}, g = {
  black: "deriv-button__color--black",
  primary: "deriv-button__color--primary",
  "primary-light": "deriv-button__color--primary-light",
  "primary-transparent": "deriv-button__color--primary-transparent",
  white: "deriv-button__color--white"
}, y = {
  lg: "deriv-button__size--lg",
  md: "deriv-button__size--md",
  sm: "deriv-button__size--sm",
  xs: "deriv-button__size--xs"
}, x = {
  lg: "deriv-button__rounded--lg",
  md: "deriv-button__rounded--md",
  sm: "deriv-button__rounded--sm"
}, F = {
  lg: "lg",
  md: "sm",
  sm: "xs",
  xs: "xs"
}, w = {
  black: "#333333",
  primary: "#FFFFFF",
  "primary-light": "#EC3F3F",
  "primary-transparent": "#ff444f14",
  white: "#85ACB0"
}, B = {
  none: "deriv-button__border-width--none",
  sm: "deriv-button__border-width--sm",
  md: "deriv-button__border-width--md",
  lg: "deriv-button__border-width--lg"
}, j = ({
  borderWidth: l = "md",
  className: a,
  color: e = "primary",
  icon: n,
  isFullWidth: s = !1,
  isLoading: r = !1,
  rounded: _ = "sm",
  size: i = "md",
  hideHoverStyles: m = !1,
  textSize: u,
  variant: d = "contained",
  ...t
}) => {
  const b = d === "contained";
  return /* @__PURE__ */ c(
    "button",
    {
      className: v(
        "deriv-button",
        f[d],
        g[e],
        y[i],
        x[_],
        B[l],
        {
          "deriv-button__full-width": s,
          "deriv-button__hover--disabled": m
        },
        a
      ),
      disabled: t.disabled || r,
      "aria-label": t.children && typeof t.children == "string" ? t.children : "",
      ...t,
      children: [
        r && /* @__PURE__ */ o("div", { className: "deriv-button__loader", children: /* @__PURE__ */ o(
          h,
          {
            color: b ? w[e] : "#85ACB0",
            isFullScreen: !1
          }
        ) }),
        n && !r && n,
        t.children && !r && /* @__PURE__ */ o(
          p,
          {
            align: "center",
            size: u ?? F[i],
            weight: "bold",
            as: "span",
            children: t.children
          }
        )
      ]
    }
  );
};
export {
  j as Button
};
