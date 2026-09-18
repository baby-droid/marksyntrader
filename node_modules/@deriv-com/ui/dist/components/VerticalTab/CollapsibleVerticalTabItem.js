import { jsxs as c, jsx as s } from "react/jsx-runtime";
import { useState as v } from "react";
import { Text as C } from "../Text/index.js";
import { c as e } from "../../clsx-OuTLNxxd.js";
import { VerticalTabItem as f } from "./VerticalTabItem.js";
const w = ({ is_open: l }) => /* @__PURE__ */ s(
  "svg",
  {
    className: e("vertical-tab__arrow", {
      "vertical-tab__arrow--open": l
    }),
    xmlns: "http://www.w3.org/2000/svg",
    width: "17",
    height: "16",
    viewBox: "0 0 17 16",
    fill: "none",
    children: /* @__PURE__ */ s(
      "path",
      {
        d: "M8.66699 9.58579L13.9599 4.29289C14.3504 3.90237 14.9836 3.90237 15.3741 4.29289C15.7646 4.68342 15.7646 5.31658 15.3741 5.70711L9.3741 11.7071C8.98358 12.0976 8.35041 12.0976 7.95989 11.7071L1.95989 5.70711C1.56936 5.31658 1.56936 4.68342 1.95989 4.29289C2.35041 3.90237 2.98357 3.90237 3.3741 4.29289L8.66699 9.58579Z",
        fill: "#333333"
      }
    )
  }
), I = ({
  item: l,
  onSelectItemHandler: d,
  selectedTab: i,
  className: p,
  iconClassName: b
}) => {
  var t, n;
  const o = (t = l == null ? void 0 : l.subItems) == null ? void 0 : t.find(
    (a) => a.id === i
  ), [r, h] = v(!!o), _ = () => {
    !o && h(!r);
  };
  return /* @__PURE__ */ c("div", { className: e("collapsible-vertical-tab"), children: [
    /* @__PURE__ */ c(
      "div",
      {
        className: e("collapsible-vertical-tab__header", {
          "collapsible-vertical-tab__header--open": o
        }),
        onClick: () => _(),
        children: [
          /* @__PURE__ */ c("span", { className: e("vertical-tab__icon", b), children: [
            " ",
            l == null ? void 0 : l.icon
          ] }),
          /* @__PURE__ */ s(C, { size: "sm", className: "vertical-tab__label", children: l.id }),
          /* @__PURE__ */ s(w, { is_open: r })
        ]
      }
    ),
    r && /* @__PURE__ */ s("div", { className: "collapsible-vertical-tab__items", children: (n = l == null ? void 0 : l.subItems) == null ? void 0 : n.map((a) => /* @__PURE__ */ s(
      f,
      {
        className: p,
        selectedTab: i,
        tab: a,
        onClick: () => d(a.id)
      },
      a.id
    )) })
  ] }, l.id);
};
export {
  I as CollapsibleVerticalTabItem
};
