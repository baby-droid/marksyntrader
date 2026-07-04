import '../../assets/InlineMessage.css';
import { jsxs as a, jsx as i } from "react/jsx-runtime";
import { c as l } from "../../clsx-OuTLNxxd.js";
import { ErrorIcon as g, InfoIcon as _, SuccessIcon as m, WarningIcon as t } from "./VariantIcons.js";
/* empty css                           */
const f = {
  error: /* @__PURE__ */ i(g, {}),
  info: /* @__PURE__ */ i(_, {}),
  success: /* @__PURE__ */ i(m, {}),
  warning: /* @__PURE__ */ i(t, {})
}, r = {
  error: {
    filled: "deriv-inline-message__error--filled",
    outlined: "deriv-inline-message__error--outlined"
  },
  general: "deriv-inline-message__general",
  info: {
    filled: "deriv-inline-message__info--filled",
    outlined: "deriv-inline-message__info--outlined"
  },
  success: {
    filled: "deriv-inline-message__success--filled",
    outlined: "deriv-inline-message__success--outlined"
  },
  warning: {
    filled: "deriv-inline-message__warning--filled",
    outlined: "deriv-inline-message__warning--outlined"
  }
}, w = ({
  icon: s,
  iconPosition: n = "center",
  children: o,
  className: d,
  variant: e = "general",
  type: c = "filled"
}) => /* @__PURE__ */ a(
  "div",
  {
    className: l(
      "deriv-inline-message",
      e !== "general" ? r[e][c] : r[e],
      d
    ),
    children: [
      (e !== "general" || s) && /* @__PURE__ */ i(
        "div",
        {
          className: l("deriv-inline-message__icon", {
            "deriv-inline-message__icon--top": n === "top",
            "deriv-inline-message__icon--center": n === "center",
            "deriv-inline-message__icon--bottom": n === "bottom"
          }),
          children: e !== "general" ? f[e] : s ?? null
        }
      ),
      o
    ]
  }
);
export {
  w as InlineMessage
};
