import '../../assets/index3.css';
import { jsxs as k, jsx as i } from "react/jsx-runtime";
import { forwardRef as s } from "react";
import { c as x } from "../../clsx-OuTLNxxd.js";
const t = s(
  ({
    checked: c = !1,
    className: b,
    disabled: e,
    error: d,
    label: l,
    labelClassName: h,
    wrapperClassName: _,
    name: r,
    ...o
  }, a) => /* @__PURE__ */ k("div", { className: x("deriv-checkbox", _), children: [
    /* @__PURE__ */ i("div", { className: "deriv-checkbox__wrapper", children: /* @__PURE__ */ i(
      "input",
      {
        id: o.id ?? r,
        className: x(
          "deriv-checkbox__box",
          {
            "deriv-checkbox__box--unchecked": !c,
            "deriv-checkbox__box--checked": c,
            "deriv-checkbox__box--disabled": e
          },
          b
        ),
        type: "checkbox",
        checked: !e && c,
        disabled: e,
        ref: a,
        name: r,
        ...o
      }
    ) }),
    /* @__PURE__ */ i(
      "label",
      {
        className: x(
          "deriv-checkbox__label",
          {
            "deriv-checkbox__label--error": d,
            "deriv-checkbox__label--disabled": e
          },
          h
        ),
        htmlFor: o.id ?? r,
        children: l
      }
    )
  ] })
);
export {
  t as Checkbox
};
