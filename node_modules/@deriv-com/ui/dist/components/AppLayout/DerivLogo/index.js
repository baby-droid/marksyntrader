import { jsx as a } from "react/jsx-runtime";
import * as e from "react";
import { forwardRef as m } from "react";
const n = ({ title: c, titleId: l, ...r }, t) => e.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 217 72", role: "img", ref: t, "aria-labelledby": l, ...r },
  c ? e.createElement("title", { id: l }, c) : null,
  e.createElement(
    "g",
    null,
    e.createElement("path", { fill: "#FF444F", d: "m43.472 2.271-3.715 21.06H26.86c-12.03 0-23.498 9.744-25.623 21.77l-.9 5.118C-1.777 62.246 6.25 71.99 18.281 71.99h10.755c8.768 0 17.122-7.095 18.664-15.86L57.605 0zm-9.15 51.872c-.475 2.707-2.914 4.911-5.622 4.911h-6.534c-5.408 0-9.026-4.388-8.077-9.803l.564-3.192c.958-5.405 6.119-9.803 11.526-9.803h11.298zm108.463 17.845 8.462-47.986h13.385l-8.462 47.986zm1.448-47.433q-1.008 5.709-2.016 11.419c-6.341-1.97-12.883-1.343-14.893-.942Q124.066 53.516 120.806 72h-13.394l8.032-45.52c4.357-1.803 15.055-5.462 28.789-1.925m-54.27-1.232h-10.42c-10.152 0-19.83 8.221-21.619 18.37L55.819 53.62C54.029 63.77 60.8 71.99 70.954 71.99h22.163l2.273-12.895H74.562c-3.38 0-5.644-2.737-5.041-6.127l.07-.405h33.58l1.918-10.87c1.789-10.149-4.982-18.37-15.135-18.37zm1.69 17.342-.079.692H71.606l.109-.613c.602-3.38 3.687-6.354 7.077-6.354h7.8c3.351 0 5.615 2.925 5.061 6.275m111.81-16.663h13.394c-4.563 12.126-15.019 32.755-25.149 47.986h-13.394c-4.65-14.496-7.653-34.695-8.225-47.986h13.395c.241 4.335 2.183 20.417 4.399 31.651 6.077-10.93 12.777-25.269 15.569-31.651z" })
  ),
  e.createElement(
    "defs",
    null,
    e.createElement(
      "clipPath",
      { id: "13c999cd16b35562fb58bc4ca441ace3__a" },
      e.createElement("path", { fill: "#fff", d: "M0 0h217v72H0z" })
    )
  )
), h = m(n), o = ({ title: c, titleId: l, ...r }, t) => e.createElement(
  "svg",
  { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 72 72", role: "img", ref: t, "aria-labelledby": l, ...r },
  c ? e.createElement("title", { id: l }, c) : null,
  e.createElement("path", { fill: "#FF444F", d: "M0 28C0 12.536 12.536 0 28 0h16c15.464 0 28 12.536 28 28v16c0 15.464-12.536 28-28 28H28C12.536 72 0 59.464 0 44z" }),
  e.createElement("path", { fill: "#fff", d: "m45.167 14.917-2.321 13.166h-8.06c-7.518 0-14.684 6.091-16.012 13.61l-.563 3.2c-1.322 7.518 3.695 13.61 11.213 13.61h6.722c5.48 0 10.7-4.436 11.664-9.916L54 13.497zM39.45 47.346c-.296 1.692-1.82 3.07-3.513 3.07h-4.084c-3.38 0-5.64-2.743-5.047-6.128l.352-1.996c.6-3.38 3.824-6.128 7.203-6.128h7.06z" })
), f = m(o), i = ({
  variant: c = "default",
  logoHeight: l,
  logoWidth: r,
  ...t
}) => /* @__PURE__ */ a("a", { ...t, children: c == "default" ? /* @__PURE__ */ a(
  h,
  {
    width: r ?? 48.22,
    height: l ?? 16
  }
) : /* @__PURE__ */ a(
  f,
  {
    width: r ?? 24,
    height: l ?? 24
  }
) });
i.displayName = "DerivLogo";
export {
  i as DerivLogo
};
