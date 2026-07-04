import { jsxs as I, Fragment as h, jsx as n } from "react/jsx-runtime";
import { memo as N, useState as V, useEffect as j } from "react";
import { CollapsibleVerticalTabItem as v } from "./CollapsibleVerticalTabItem.js";
import { VerticalTabItem as T } from "./VerticalTabItem.js";
import { c as b } from "../../clsx-OuTLNxxd.js";
const E = N(
  ({
    items: c,
    panelClassName: p,
    wrapperClassName: m,
    itemClassName: l,
    activeTab: e,
    should_have_panel: _ = !0,
    onSelectItem: o
  }) => {
    var u;
    const [t, f] = V(e);
    j(() => {
      e && f(e);
    }, [e]);
    const d = (r) => {
      for (const s of c)
        if (s != null && s.subItems) {
          const a = s == null ? void 0 : s.subItems.find(
            (x) => x.id === r
          );
          if (a)
            return a;
        } else if (s.id === r)
          return s;
    }, i = (r) => {
      var a;
      const s = (a = d(r)) == null ? void 0 : a.id;
      f(() => s ?? e), o == null || o(r);
    };
    return /* @__PURE__ */ I(h, { children: [
      /* @__PURE__ */ n(
        "div",
        {
          className: b(
            "vertical-tab__items-container",
            m
          ),
          children: c.map((r) => r != null && r.subItems ? /* @__PURE__ */ n(
            v,
            {
              item: r,
              selectedTab: t,
              onSelectItemHandler: i,
              className: l
            },
            r.id
          ) : /* @__PURE__ */ n(
            T,
            {
              className: l,
              selectedTab: t,
              tab: r,
              onClick: () => i(r.id)
            },
            r.id
          ))
        }
      ),
      _ && /* @__PURE__ */ n(
        "div",
        {
          className: b("vertical-tab__panel", p),
          children: (u = d(t)) == null ? void 0 : u.panel
        }
      )
    ] });
  }
);
export {
  E as VerticalTabItems
};
