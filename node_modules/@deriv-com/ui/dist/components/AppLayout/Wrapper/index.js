import '../../../assets/index13.css';
import { jsx as i } from "react/jsx-runtime";
import { c as s } from "../../../clsx-OuTLNxxd.js";
const t = ({
  children: p,
  className: e,
  variant: r,
  ...a
}) => /* @__PURE__ */ i(
  "div",
  {
    className: s(
      "deriv-wrapper",
      { "deriv-wrapper__left": r == "left" },
      { "deriv-wrapper__right": r == "right" },
      e
    ),
    ...a,
    children: p
  }
);
t.displayName = "Wrapper";
export {
  t as Wrapper
};
