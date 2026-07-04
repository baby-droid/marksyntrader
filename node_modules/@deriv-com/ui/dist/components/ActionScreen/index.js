import '../../assets/ActionScreen.css';
import { jsxs as i, jsx as n } from "react/jsx-runtime";
import { isValidElement as d } from "react";
import { Text as c } from "../Text/index.js";
/* empty css                          */
const v = ({
  actionButtons: s,
  description: e,
  descriptionSize: m = "md",
  icon: o,
  title: r,
  titleSize: t = "md"
}) => /* @__PURE__ */ i("div", { className: "derivs-action-screen", children: [
  o,
  /* @__PURE__ */ i("div", { className: "derivs-action-screen__info", children: [
    r && /* @__PURE__ */ n(c, { align: "center", size: t, weight: "bold", children: r }),
    d(e) ? e : /* @__PURE__ */ n(c, { align: "center", size: m, children: e })
  ] }),
  s
] });
export {
  v as ActionScreen
};
