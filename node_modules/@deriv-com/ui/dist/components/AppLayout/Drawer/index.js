import '../../../assets/index9.css';
import { jsxs as w, Fragment as p, jsx as a } from "react/jsx-runtime";
import { useState as v, useRef as x, useEffect as D } from "react";
import { DrawerHeader as y } from "./DrawerHeader/index.js";
import { DrawerContent as _ } from "./DrawerContent/index.js";
import { DrawerFooter as C } from "./DrawerFooter/index.js";
import { c as i } from "../../../clsx-OuTLNxxd.js";
const e = ({
  isOpen: r,
  onCloseDrawer: m,
  width: s = "auto",
  children: n,
  className: l,
  overlayClassName: c,
  ...d
}) => {
  const [u, o] = v(!0), t = x(null);
  return D(() => (r ? o(!1) : t.current = setTimeout(() => {
    o(!r);
  }, 400), () => {
    t.current && clearTimeout(t.current);
  }), [r]), u ? null : /* @__PURE__ */ w(p, { children: [
    /* @__PURE__ */ a(
      "div",
      {
        "data-testid": "drawer-overlay",
        className: i(
          "deriv-drawer__overlay",
          !r && "exit",
          c
        ),
        onClick: (f) => {
          f.stopPropagation(), m();
        }
      }
    ),
    /* @__PURE__ */ a(
      "div",
      {
        className: i(
          "deriv-drawer__container",
          !r && "exit",
          l
        ),
        style: { width: s },
        ...d,
        children: n
      }
    )
  ] });
};
e.Header = y;
e.Content = _;
e.Footer = C;
e.displayName = "Drawer";
export {
  e as Drawer
};
