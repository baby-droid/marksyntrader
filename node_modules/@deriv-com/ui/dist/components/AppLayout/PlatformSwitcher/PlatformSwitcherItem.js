import '../../../assets/PlatformSwitcher.css';
import { jsxs as o, jsx as s } from "react/jsx-runtime";
import { c as a } from "../../../clsx-OuTLNxxd.js";
import { Text as l } from "../../Text/index.js";
/* empty css                                 */
const c = ({
  icon: e,
  description: r,
  active: t,
  className: i,
  ...m
}) => /* @__PURE__ */ o(
  "a",
  {
    role: "link",
    className: a(
      "deriv-platform-switcher__item",
      {
        "deriv-platform-switcher__item--active": t
      },
      i
    ),
    ...m,
    children: [
      e,
      /* @__PURE__ */ s(
        l,
        {
          className: "deriv-platform-switcher__item-text",
          size: "sm",
          as: "p",
          color: "general",
          children: r
        }
      )
    ]
  }
);
c.displayName = "PlatformSwitcherItem";
export {
  c as PlatformSwitcherItem
};
