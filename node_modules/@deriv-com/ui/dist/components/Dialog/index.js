import '../../assets/index4.css';
import { jsx as a } from "react/jsx-runtime";
import { c as i } from "../../clsx-OuTLNxxd.js";
import { Modal as r } from "../Modal/index.js";
import { DialogHeader as p } from "./DialogHeader.js";
import { DialogBody as l } from "./DialogBody.js";
import { DialogFooter as s } from "./DialogFooter.js";
const o = ({ children: e, className: m, ...t }) => /* @__PURE__ */ a(r, { className: i("deriv-dialog", m), ariaHideApp: !1, ...t, children: e });
o.Header = p;
o.Body = l;
o.Footer = s;
o.setAppElement = r.setAppElement;
export {
  o as Dialog
};
