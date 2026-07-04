import { jsx as r } from "react/jsx-runtime";
import { Modal as a } from "../Modal/index.js";
import { Text as m } from "../Text/index.js";
const c = ({ children: e, className: o, hideCloseIcon: t = !0, textClassName: d, ...i }) => /* @__PURE__ */ r(a.Header, { hideBorder: !0, hideCloseIcon: t, className: o, ...i, children: /* @__PURE__ */ r(m, { as: "div", weight: "bold", className: d, children: e }) });
export {
  c as DialogHeader
};
