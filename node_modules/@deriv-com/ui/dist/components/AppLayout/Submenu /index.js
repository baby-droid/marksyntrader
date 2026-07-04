import '../../../assets/index14.css';
import { jsx as o } from "react/jsx-runtime";
import { useRef as l, useState as c, useEffect as i } from "react";
import { c as f } from "../../../clsx-OuTLNxxd.js";
const a = ({
  children: u,
  className: s,
  isOpen: e,
  ...m
}) => {
  const t = l(null), [n, r] = c(!0);
  return i(() => (e ? r(!1) : t.current = setTimeout(() => {
    r(!e);
  }, 400), () => {
    t.current && clearTimeout(t.current);
  }), [e]), n ? null : /* @__PURE__ */ o(
    "div",
    {
      className: f("submenu", { submenu_exit: !e }, s),
      ...m,
      children: u
    }
  );
};
a.displayName = "Submenu";
export {
  a as Submenu
};
