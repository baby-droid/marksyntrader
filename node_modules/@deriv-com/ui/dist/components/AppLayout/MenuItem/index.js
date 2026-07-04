import '../../../assets/index12.css';
import { jsxs as c } from "react/jsx-runtime";
import { c as o } from "../../../clsx-OuTLNxxd.js";
const u = ({
  as: e,
  leftComponent: m,
  children: t,
  rightComponent: r,
  disableHover: i,
  active: s,
  className: a,
  ...n
}) => /* @__PURE__ */ c(
  e,
  {
    className: o(
      "deriv-menu-item",
      { "deriv-menu-item--active": s || i },
      a
    ),
    ...n,
    children: [
      m,
      t,
      r
    ]
  }
);
u.displayName = "MenuItem";
export {
  u as MenuItem
};
