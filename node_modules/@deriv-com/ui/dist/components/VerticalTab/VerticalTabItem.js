import { jsxs as e, jsx as r } from "react/jsx-runtime";
import { c as m } from "../../clsx-OuTLNxxd.js";
import { Text as a } from "../Text/index.js";
const n = ({
  tab: i,
  onClick: s,
  className: c,
  selectedTab: l
}) => /* @__PURE__ */ e(
  "div",
  {
    className: m(
      "vertical-tab__item",
      {
        "vertical-tab__item--active": i.id === l,
        "vertical-tab__item--disabled": i.is_disabled
      },
      c
    ),
    onClick: () => !i.is_disabled && s(i.id),
    children: [
      (i == null ? void 0 : i.icon) && /* @__PURE__ */ e("span", { className: "vertical-tab__icon", children: [
        " ",
        i == null ? void 0 : i.icon
      ] }),
      /* @__PURE__ */ r(a, { size: "sm", as: "span", className: "vertical-tab__label", children: i.title })
    ]
  }
);
export {
  n as VerticalTabItem
};
