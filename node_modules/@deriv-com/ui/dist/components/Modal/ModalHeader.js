import { jsxs as l, jsx as c } from "react/jsx-runtime";
import { c as i } from "../../clsx-OuTLNxxd.js";
import { CloseIcon as m } from "./CloseIcon.js";
const f = ({ children: o, hideCloseIcon: e, className: r, onRequestClose: d, hideBorder: a = !1, ...s }) => /* @__PURE__ */ l("div", { className: i("deriv-modal__header", {
  "deriv-modal__header--no-border": a
}, r), ...s, children: [
  o,
  !e && /* @__PURE__ */ c(m, { "data-testid": "dt-close-icon", onClick: d, className: "deriv-modal__close-icon" })
] });
export {
  f as ModalHeader
};
