import '../../assets/SideNote.css';
import { jsxs as r, jsx as e } from "react/jsx-runtime";
import { c as t } from "../../clsx-OuTLNxxd.js";
import { ChevronRightIcon as p } from "./ChevronRightIcon.js";
import { Text as s } from "../Text/index.js";
/* empty css                      */
const b = ({
  children: d,
  title: i,
  titleSize: n = "sm",
  className: m,
  actionClick: o,
  actionClassName: l,
  titleClassName: c,
  actionLabel: a = "Learn more",
  ...h
}) => /* @__PURE__ */ r("div", { className: t("deriv-side-note", m), ...h, children: [
  i && /* @__PURE__ */ e(
    s,
    {
      "data-testid": "dt_deriv-side-note-title",
      className: t("deriv-side-note__title", c),
      size: n,
      align: "left",
      weight: "bold",
      children: i
    }
  ),
  d,
  o && /* @__PURE__ */ r(
    "button",
    {
      className: t("deriv-side-note__action", l),
      onClick: o,
      type: "button",
      children: [
        /* @__PURE__ */ e(s, { color: "red", size: "xs", children: a }),
        /* @__PURE__ */ e(p, {})
      ]
    }
  )
] });
export {
  b as SideNote
};
