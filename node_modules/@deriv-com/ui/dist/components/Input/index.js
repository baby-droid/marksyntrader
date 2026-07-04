import '../../assets/index5.css';
import { jsxs as u, jsx as e } from "react/jsx-runtime";
import { forwardRef as g } from "react";
import { c as l } from "../../clsx-OuTLNxxd.js";
import h from "./HelperMessage.js";
const N = {
  general: "deriv-input--general",
  success: "deriv-input--success",
  warning: "deriv-input--general",
  error: "deriv-input--error",
  disabled: "deriv-input--disabled"
}, x = {
  general: "deriv-input__label--general",
  success: "deriv-input__label--success",
  warning: "deriv-input__label--general",
  error: "deriv-input__label--error",
  disabled: "deriv-input__label--disabled"
}, F = g(
  ({
    className: c,
    disabled: i,
    error: r,
    hideMessage: v,
    id: a,
    isFullWidth: _ = !1,
    islabelAnimationDisabled: o = !1,
    label: s,
    leftPlaceholder: t,
    message: d,
    rightPlaceholder: p,
    variant: n = "general",
    wrapperClassName: m,
    ...b
  }, f) => /* @__PURE__ */ u(
    "div",
    {
      className: l(
        "deriv-input__container",
        {
          "deriv-input__container--full": _
        },
        m
      ),
      children: [
        /* @__PURE__ */ u(
          "div",
          {
            className: l(
              "deriv-input",
              c,
              N[r ? "error" : n],
              {
                "deriv-input--disabled": i
              }
            ),
            children: [
              t && /* @__PURE__ */ e("div", { className: "deriv-input__left-content", children: t }),
              /* @__PURE__ */ e(
                "input",
                {
                  placeholder: s,
                  className: o ? "deriv-input--label-animation-disabled" : "deriv-input__field",
                  id: a,
                  disabled: i,
                  ref: f,
                  ...b
                }
              ),
              /* @__PURE__ */ e(
                "label",
                {
                  className: l(
                    "deriv-input__label",
                    x[r ? "error" : n],
                    {
                      "deriv-input--label--disabled": i
                    }
                  ),
                  htmlFor: a,
                  children: s
                }
              ),
              p && /* @__PURE__ */ e("div", { className: "deriv-input__right-content", children: p })
            ]
          }
        ),
        !v && d && /* @__PURE__ */ e("div", { className: "deriv-input__helper-message", children: /* @__PURE__ */ e(
          h,
          {
            message: d,
            variant: n,
            error: r,
            disabled: i
          }
        ) })
      ]
    }
  )
);
export {
  F as Input
};
