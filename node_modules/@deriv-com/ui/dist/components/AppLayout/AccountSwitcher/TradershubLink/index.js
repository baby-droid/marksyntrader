import '../../../../assets/index20.css';
import { jsx as r } from "react/jsx-runtime";
import { c as t } from "../../../../clsx-OuTLNxxd.js";
const d = ({
  children: s,
  className: a,
  href: c = "#",
  target: e = "_blank",
  ...i
}) => /* @__PURE__ */ r(
  "div",
  {
    className: t(
      "deriv-account-switcher__tradershub-link",
      a
    ),
    children: /* @__PURE__ */ r("a", { href: c, target: e, ...i, children: s })
  }
);
export {
  d as TradershubLink
};
