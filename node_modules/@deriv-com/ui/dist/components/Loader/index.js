import '../../assets/index6.css';
import { jsxs as l, jsx as s } from "react/jsx-runtime";
import { c as d } from "../../clsx-OuTLNxxd.js";
const t = ({
  color: e = "#85ACB0",
  isFullScreen: a = !0,
  className: r
}) => /* @__PURE__ */ l(
  "div",
  {
    className: d(
      "derivs-loader",
      { "derivs-loader--fullscreen": a },
      r
    ),
    "data-testid": "dt_derivs-loader",
    children: [
      /* @__PURE__ */ s(
        "span",
        {
          className: "derivs-loader__element",
          role: "span",
          style: { backgroundColor: e }
        }
      ),
      /* @__PURE__ */ s(
        "span",
        {
          className: "derivs-loader__element",
          style: { backgroundColor: e }
        }
      ),
      /* @__PURE__ */ s(
        "span",
        {
          className: "derivs-loader__element",
          style: { backgroundColor: e }
        }
      ),
      /* @__PURE__ */ s(
        "span",
        {
          className: "derivs-loader__element",
          style: { backgroundColor: e }
        }
      ),
      /* @__PURE__ */ s(
        "span",
        {
          className: "derivs-loader__element",
          style: { backgroundColor: e }
        }
      )
    ]
  }
);
export {
  t as Loader
};
