import '../../assets/Text.css';
import { jsx as m } from "react/jsx-runtime";
import { c as d } from "../../clsx-OuTLNxxd.js";
/* empty css                  */
const p = ({
  align: t = "left",
  as: e = "span",
  children: s,
  color: r = "general",
  fontStyle: i = "normal",
  lineHeight: o,
  size: a = "md",
  weight: x = "normal",
  className: _,
  ...l
}) => {
  const n = d(
    "deriv-text",
    `derivs-text__size--${a}`,
    `derivs-text__weight--${x}`,
    `derivs-text__align--${t}`,
    `derivs-text__color--${r}`,
    `derivs-text__line-height--${o}`,
    `derivs-text__font-style--${i}`,
    _
  );
  return /* @__PURE__ */ m(e, { className: n, ...l, children: s });
};
export {
  p as Text
};
