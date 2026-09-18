import '../../../assets/index24.css';
import { jsx as e, Fragment as A, jsxs as u } from "react/jsx-runtime";
import * as l from "react";
import { forwardRef as S, useState as T, useRef as _ } from "react";
import { a as y } from "../../../index-EY1gwl5O.js";
import { Modal as d } from "../../Modal/index.js";
import { ContextMenu as R } from "../../ContextMenu/index.js";
import { useDevice as g } from "../../../hooks/useDevice.js";
import f from "../../Tabs/Tabs.js";
import { AccountsPanel as F } from "./AccountsPanel/index.js";
import { AccountsItem as N } from "./AccountsItem/index.js";
import { AccountSwitcherFooter as k } from "./Footer/index.js";
import { TotalAsset as C } from "./TotalAsset/index.js";
import { AccountSwitcherTab as E } from "./Tab/index.js";
import { TradershubLink as z } from "./TradershubLink/index.js";
import { c as D } from "../../../clsx-OuTLNxxd.js";
import { s as O } from "../../../index-CQbz1p6_.js";
import { F as I } from "../../../LegacyChevronDown2pxIcon-CQ-CdTZp.js";
const M = ({ iconSize: n = "md", title: o, titleId: t, ...i }, r) => l.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 16 16", ...O[n], role: "img", ref: r, "aria-labelledby": t, ...i },
  o ? l.createElement("title", { id: t }, o) : null,
  l.createElement("path", { fill: "#333", d: "m8 6.414-5.293 5.293a1 1 0 0 1-1.414-1.414l6-6a1 1 0 0 1 1.414 0l6 6a1 1 0 0 1-1.414 1.414z" })
), P = S(M), c = ({
  children: n,
  activeAccount: o,
  isDisabled: t = !1,
  buttonClassName: i,
  tabsLabels: r,
  modalContentStyle: h
}) => {
  const [m, a] = T(!1), s = _(null), { isDesktop: w } = g(), p = () => {
    a(!1);
  }, v = () => {
    a(!0);
  };
  return y(s, p), /* @__PURE__ */ e(A, { children: /* @__PURE__ */ u(
    "div",
    {
      className: D(
        "deriv-account-switcher__button",
        i
      ),
      onClick: () => {
        s.current || v();
      },
      children: [
        /* @__PURE__ */ e("div", { className: "deriv-account-switcher__currency-icon", children: o.icon }),
        /* @__PURE__ */ u("div", { className: "deriv-account-switcher__balance", children: [
          /* @__PURE__ */ e("span", { children: o.balance }),
          /* @__PURE__ */ e("span", { children: o.currency })
        ] }),
        t ? null : m ? /* @__PURE__ */ e(P, { iconSize: "xs" }) : /* @__PURE__ */ e(I, { iconSize: "xs" }),
        t ? null : w ? /* @__PURE__ */ e(
          R,
          {
            ref: s,
            className: "deriv-account-switcher__container",
            isOpen: m,
            children: n && /* @__PURE__ */ e(
              f,
              {
                activeTab: o.isVirtual ? (r == null ? void 0 : r.demo) ?? "Demo" : (r == null ? void 0 : r.real) ?? "Real",
                variant: "secondary",
                children: n
              }
            )
          }
        ) : /* @__PURE__ */ e(
          d,
          {
            closeTimeoutMS: 200,
            onRequestClose: (x) => {
              x.stopPropagation(), p();
            },
            className: "deriv-account-switcher__container--mobile",
            isOpen: m,
            style: h ?? {},
            children: n && /* @__PURE__ */ e(
              f,
              {
                activeTab: o.isVirtual ? (r == null ? void 0 : r.demo) ?? "Demo" : (r == null ? void 0 : r.real) ?? "Real",
                variant: "secondary",
                children: n
              }
            )
          }
        )
      ]
    }
  ) });
};
c.Tab = E;
c.AccountsPanel = F;
c.AccountsItem = N;
c.TotalAsset = C;
c.TradersHubLink = z;
c.Footer = k;
c.setAppElement = d.setAppElement;
c.DisplayName = "AccountSwitcher";
export {
  c as AccountSwitcher
};
