import '../../../../assets/index16.css';
import { jsx as i } from "react/jsx-runtime";
import { Accordion as l } from "../../../Accordion/index.js";
import { c as e } from "../../../../clsx-OuTLNxxd.js";
const f = ({
  children: r,
  title: t,
  className: c,
  headerClassName: o,
  isOpen: s = !1,
  ...a
}) => /* @__PURE__ */ i(
  l,
  {
    defaultOpen: s,
    className: e("deriv-account-switcher__list", c),
    headerClassName: e(
      "deriv-account-switcher__title",
      o
    ),
    title: t,
    ...a,
    children: r
  }
);
export {
  f as AccountsPanel
};
