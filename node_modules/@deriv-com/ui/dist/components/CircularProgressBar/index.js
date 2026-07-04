import '../../assets/CircularProgressBar.css';
import { jsx as s, jsxs as m } from "react/jsx-runtime";
import { c as i } from "../../clsx-OuTLNxxd.js";
/* empty css                                 */
const _ = ({
  children: a,
  className: n,
  danger_limit: t = 20,
  is_clockwise: h = !1,
  progress: c = 0,
  radius: r = 22,
  stroke: o = 3,
  warning_limit: d = 50
}) => {
  const l = r - o / 2, e = l * 2 * Math.PI, g = e - c / 100 * e;
  return /* @__PURE__ */ s("div", { className: i("deriv-circular-progress", n), children: /* @__PURE__ */ m("svg", { height: r * 2, width: r * 2, children: [
    a && /* @__PURE__ */ s("foreignObject", { x: "0", y: "0", width: r * 2, height: r * 2, children: /* @__PURE__ */ s("div", { className: i("deriv-circular-progress__content"), children: a }) }),
    /* @__PURE__ */ s(
      "circle",
      {
        className: i("deriv-circular-progress__bar", {
          "deriv-circular-progress--clockwise": h,
          "deriv-circular-progress__bar--warning": c <= d && c > t,
          "deriv-circular-progress__bar--danger": c <= t
        }),
        cx: r,
        cy: r,
        fill: "transparent",
        r: l,
        strokeDasharray: `${e} ${e}`,
        strokeWidth: o,
        style: { strokeDashoffset: g }
      }
    )
  ] }) });
};
export {
  _ as CircularProgressBar
};
