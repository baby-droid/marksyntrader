import '../../assets/HelperMessage.css';
import { jsx as l } from "react/jsx-runtime";
import { c as g } from "../../clsx-OuTLNxxd.js";
const i = {
  general: "deriv-helper-message--general",
  success: "deriv-helper-message--success",
  warning: "deriv-helper-message--warning",
  error: "deriv-helper-message--error"
}, p = ({
  error: r,
  message: s,
  variant: a = "general",
  disabled: e
}) => /* @__PURE__ */ l(
  "p",
  {
    className: g("deriv-helper-message", {
      "deriv-helper-message--disabled": e,
      [i[r ? "error" : a]]: !e
    }),
    children: s
  }
);
export {
  p as default
};
