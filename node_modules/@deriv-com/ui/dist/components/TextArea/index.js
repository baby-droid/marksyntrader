import '../../assets/index7.css';
import { jsxs as c, jsx as s } from "react/jsx-runtime";
import { forwardRef as x } from "react";
import { c as g } from "../../clsx-OuTLNxxd.js";
import { Text as l } from "../Text/index.js";
const w = x(({
  hint: i,
  isInvalid: e = !1,
  label: n,
  maxLength: o,
  textSize: a,
  shouldShowCounter: f = !1,
  value: r,
  onChange: d,
  ...m
}, p) => {
  const h = (t) => {
    o && t.target.value.length > o && (t.target.value = t.target.value.slice(0, o)), d && d(t);
  };
  return /* @__PURE__ */ c(
    "div",
    {
      className: g("deriv-textarea", {
        "deriv-textarea--error": e
      }),
      children: [
        /* @__PURE__ */ s("textarea", { "data-has-value": !!r, value: r, onChange: h, ref: p, ...m }),
        n && /* @__PURE__ */ s("label", { children: /* @__PURE__ */ s(
          l,
          {
            color: e ? "error" : "less-prominent",
            size: a,
            children: n
          }
        ) }),
        /* @__PURE__ */ c("div", { className: "deriv-textarea__footer", children: [
          i && /* @__PURE__ */ s(
            l,
            {
              as: "p",
              color: e ? "error" : "less-prominent",
              size: a,
              children: i
            }
          ),
          f && /* @__PURE__ */ c(
            l,
            {
              color: e ? "error" : "less-prominent",
              size: a,
              children: [
                (r == null ? void 0 : r.length) ?? 0,
                "/",
                o
              ]
            }
          )
        ] })
      ]
    }
  );
});
export {
  w as TextArea
};
