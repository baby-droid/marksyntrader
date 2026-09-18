import '../../../assets/PlatformSwitcher.css';
import { jsxs as i, jsx as c } from "react/jsx-runtime";
import { c as r } from "../../../clsx-OuTLNxxd.js";
/* empty css                                 */
import { F as h } from "../../../LegacyChevronDown2pxIcon-CQ-CdTZp.js";
const l = ({
  icon: o,
  className: e,
  iconSize: t = 16,
  iconClassName: a,
  isExpanded: m,
  ...s
}) => /* @__PURE__ */ i(
  "button",
  {
    className: r("deriv-platform-switcher__button", e),
    ...s,
    children: [
      o,
      /* @__PURE__ */ c(
        h,
        {
          className: r(
            "deriv-platform-switcher__button-chevron",
            {
              "deriv-platform-switcher__button-chevron__expanded": m
            },
            a
          ),
          width: t,
          height: t
        }
      )
    ]
  }
);
l.displayName = "PlatformSwitcherButton";
export {
  l as PlatformSwitcherButton
};
