import '../../../assets/PlatformSwitcher.css';
import { jsxs as c, jsx as t } from "react/jsx-runtime";
import { useState as _, useRef as h } from "react";
import { c as m } from "../../../clsx-OuTLNxxd.js";
import { a as u } from "../../../index-EY1gwl5O.js";
import { PlatformSwitcherButton as v } from "./PlatformSwitcherButton.js";
import { ContextMenu as x } from "../../ContextMenu/index.js";
/* empty css                                 */
const w = ({
  buttonProps: n,
  children: l,
  bottomLinkLabel: s,
  bottomLinkProps: d,
  itemsWrapperClassName: p,
  overlayClassName: f
}) => {
  const [e, o] = _(!1), r = h(null);
  return u(r, (i) => {
    i.stopPropagation(), o((a) => !a);
  }), /* @__PURE__ */ c("div", { className: "deriv-platform-switcher", children: [
    /* @__PURE__ */ t(
      v,
      {
        isExpanded: e,
        onClick: (i) => {
          r.current || (i.stopPropagation(), o((a) => !a));
        },
        ...n
      }
    ),
    e && /* @__PURE__ */ t(
      "div",
      {
        className: m(
          "deriv-platform-switcher__overlay",
          f
        ),
        "data-testid": "dt_overlay"
      }
    ),
    /* @__PURE__ */ t(
      x,
      {
        ref: r,
        className: m(
          "deriv-platform-switcher__context-menu",
          p
        ),
        "data-testid": "dt_context_Menu",
        isOpen: e,
        children: /* @__PURE__ */ c("div", { className: "deriv-platform-switcher__context-menu__wrapper", children: [
          /* @__PURE__ */ t("div", { className: "deriv-platform-switcher__context-menu__items", children: l }),
          s && /* @__PURE__ */ t("div", { className: "deriv-platform-switcher__context-menu__link", children: /* @__PURE__ */ t("a", { ...d, children: s }) })
        ] })
      }
    )
  ] });
};
w.displayName = "PlatformSwitcher";
export {
  w as PlatformSwitcher
};
