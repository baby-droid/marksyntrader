import '../../assets/index15.css';
import { jsx as i } from "react/jsx-runtime";
import { c as m } from "../../clsx-OuTLNxxd.js";
import { forwardRef as a, useState as l, useRef as d, useEffect as x } from "react";
const C = a(
  ({
    children: o,
    className: u,
    isOpen: e,
    ...n
  }, c) => {
    const [f, r] = l(!0), t = d(null);
    return x(() => (e ? r(!1) : t.current = setTimeout(() => {
      r(!e);
    }, 400), () => {
      t.current && clearTimeout(t.current);
    }), [e]), f ? null : /* @__PURE__ */ i(
      "div",
      {
        ref: c,
        className: m(
          "deriv-context-menu",
          !e && "deriv-fadeout",
          u
        ),
        onClick: (s) => s.stopPropagation(),
        ...n,
        children: o
      }
    );
  }
);
export {
  C as ContextMenu
};
