import '../../assets/PasswordMeter.css';
import { jsx as r } from "react/jsx-runtime";
import { c as s } from "../../clsx-OuTLNxxd.js";
/* empty css                           */
const _ = {
  0: "deriv-password__meter__bar--error",
  1: "deriv-password__meter__bar--weak",
  2: "deriv-password__meter__bar--moderate",
  3: "deriv-password__meter__bar--strong",
  4: "deriv-password__meter__bar--complete",
  5: "deriv-password__meter__bar--error"
}, t = ({ score: e }) => /* @__PURE__ */ r("div", { className: "deriv-password__meter", children: /* @__PURE__ */ r(
  "div",
  {
    className: s(
      "deriv-password__meter__bar",
      _[e]
    )
  }
) });
export {
  t as PasswordMeter
};
