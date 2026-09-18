import '../../assets/index8.css';
import { jsxs as h, jsx as r } from "react/jsx-runtime";
import { forwardRef as k, useState as x, useEffect as w } from "react";
import { c as i } from "../../clsx-OuTLNxxd.js";
const b = k(
  ({
    onChange: e,
    value: s = !1,
    wrapperClassName: o,
    className: l,
    wrapperStyle: d,
    style: f
  }, m) => {
    const [c, t] = x(s);
    w(() => {
      s !== void 0 && t(s);
    }, [s]);
    const a = (p) => {
      t(!c), e == null || e(p);
    };
    return /* @__PURE__ */ h(
      "label",
      {
        className: i("deriv-toggle-switch", o),
        style: d,
        children: [
          /* @__PURE__ */ r(
            "input",
            {
              checked: c,
              onChange: a,
              ref: m,
              type: "checkbox",
              className: i(l),
              style: f
            }
          ),
          /* @__PURE__ */ r("span", { className: "deriv-toggle-switch__slider" })
        ]
      }
    );
  }
);
export {
  b as ToggleSwitch
};
