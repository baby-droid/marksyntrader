import '../../../../assets/index19.css';
import { jsxs as e, jsx as s } from "react/jsx-runtime";
import { c as o } from "../../../../clsx-OuTLNxxd.js";
import { Text as a } from "../../../Text/index.js";
const v = ({
  title: t,
  description: i,
  value: l,
  className: r,
  ...d
}) => /* @__PURE__ */ e("div", { className: o("deriv-total-assets", r), ...d, children: [
  /* @__PURE__ */ e("div", { className: "deriv-total-assets__details", children: [
    /* @__PURE__ */ s(a, { as: "span", className: "deriv-total-assets__title", children: t }),
    /* @__PURE__ */ s(a, { as: "span", className: "deriv-total-assets__value", children: l })
  ] }),
  /* @__PURE__ */ s(a, { as: "div", className: "deriv-total-assets__description", children: i })
] });
export {
  v as TotalAsset
};
