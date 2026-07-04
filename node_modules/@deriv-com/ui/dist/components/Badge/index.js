import '../../assets/index2.css';
import { jsxs as b, jsx as x } from "react/jsx-runtime";
import { forwardRef as $, isValidElement as l } from "react";
import { c as u } from "../../clsx-OuTLNxxd.js";
import { Text as j } from "../Text/index.js";
const E = $(
  ({
    children: e,
    className: s,
    color: d = "general",
    isBold: t = !1,
    leftIcon: i,
    padding: g = "tight",
    rightIcon: _,
    rounded: m = "sm",
    badgeSize: a = "md",
    textSize: p,
    variant: f = "contained",
    ...n
  }, v) => {
    var o;
    const r = typeof e == "string" || l(e) && typeof ((o = e == null ? void 0 : e.props) == null ? void 0 : o.i18n_default_text) == "string";
    return /* @__PURE__ */ b(
      "div",
      {
        ref: v,
        className: u(
          "deriv-badge",
          `deriv-badge__variant--${f}`,
          `deriv-badge__size--${g}`,
          `deriv-badge__color--${d}`,
          `deriv-badge__padding--${a}`,
          `deriv-badge__rounded--${m}`,
          {
            "deriv-badge__variant--bold-text": t
          },
          s
        ),
        ...n,
        children: [
          i,
          (e || r) && (r ? /* @__PURE__ */ x(
            j,
            {
              align: "center",
              size: p ?? a,
              weight: t ? "bold" : "normal",
              as: "span",
              children: e
            }
          ) : e),
          _
        ]
      }
    );
  }
);
export {
  E as Badge
};
