import '../../assets/LinearProgressBar.css';
import { jsx as e, jsxs as n } from "react/jsx-runtime";
import m from "react";
import { c as _ } from "../../clsx-OuTLNxxd.js";
import { Text as v } from "../Text/index.js";
/* empty css                               */
const g = ({
  danger_limit: i,
  is_loading: a,
  label: l,
  percentage: r,
  labelSize: d = "xs",
  warning_limit: s,
  ...o
}) => /* @__PURE__ */ e("div", { className: "deriv-linear-progress-bar", ...o, children: /* @__PURE__ */ n(m.Fragment, { children: [
  /* @__PURE__ */ e(v, { size: d, className: "deriv-linear-progress-bar__remaining-time", children: l }),
  a || r < 1 ? /* @__PURE__ */ e("div", { className: "deriv-linear-progress-bar__infinite-loader", children: /* @__PURE__ */ e("div", { className: "deriv-linear-progress-bar__infinite-loader--indeterminate" }) }) : /* @__PURE__ */ e("div", { className: "deriv-linear-progress-bar__track", children: /* @__PURE__ */ e(
    "div",
    {
      className: _("deriv-linear-progress-bar__line", {
        "deriv-linear-progress-bar__line--green": r >= s,
        "deriv-linear-progress-bar__line--yellow": r < s && r >= i,
        "deriv-linear-progress-bar__line--red": r < i
      }),
      style: { width: `${r}%` }
    }
  ) })
] }) });
export {
  g as LinearProgressBar
};
