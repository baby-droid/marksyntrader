import * as e from "react";
import { forwardRef as m } from "react";
import { s as n } from "./index-CQbz1p6_.js";
const s = ({ iconSize: a = "md", title: r, titleId: o, ...l }, t) => e.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 16 16", ...n[a], role: "img", ref: t, "aria-labelledby": o, ...l },
  r ? e.createElement("title", { id: o }, r) : null,
  e.createElement("path", { fill: "#333", d: "m8 9.586 5.293-5.293a1 1 0 1 1 1.414 1.414l-6 6a1 1 0 0 1-1.414 0l-6-6a1 1 0 1 1 1.414-1.414z" })
), c = m(s);
export {
  c as F
};
