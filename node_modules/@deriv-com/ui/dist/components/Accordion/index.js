import '../../assets/index23.css';
import { jsxs as v, jsx as r } from "react/jsx-runtime";
import { forwardRef as b, useState as l, useRef as A, useEffect as H } from "react";
import { c } from "../../clsx-OuTLNxxd.js";
const L = "data:image/svg+xml,%3csvg%20width='16'%20height='16'%20viewBox='0%200%2016%2016'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M8%209.58579L13.2929%204.29289C13.6834%203.90237%2014.3166%203.90237%2014.7071%204.29289C15.0976%204.68342%2015.0976%205.31658%2014.7071%205.70711L8.70711%2011.7071C8.31659%2012.0976%207.68342%2012.0976%207.2929%2011.7071L1.29289%205.70711C0.902369%205.31658%200.902369%204.68342%201.29289%204.29289C1.68342%203.90237%202.31658%203.90237%202.70711%204.29289L8%209.58579Z'%20fill='%23333333'/%3e%3c/svg%3e", y = {
  bordered: "deriv-accordion--bordered",
  shadow: "deriv-accordion--shadow",
  underline: "deriv-accordion--underline"
}, k = b(
  ({
    defaultOpen: d = !1,
    children: h,
    isCompact: a = !1,
    onScrollToAccordion: n,
    title: t,
    variant: m = "underline",
    className: g,
    headerClassName: _,
    contentClassName: f,
    ...x
  }, p) => {
    const [e, u] = l(d), [w, C] = l(
      d ? "auto" : "0px"
    ), o = A(null);
    H(() => {
      var s;
      const i = (s = o == null ? void 0 : o.current) == null ? void 0 : s.scrollHeight;
      C(e ? `${i}px` : "0px");
    }, [e]);
    const N = () => {
      const i = !e;
      u(i), setTimeout(() => {
        n && i && n();
      }, 200);
    };
    return /* @__PURE__ */ v(
      "div",
      {
        className: c(
          "deriv-accordion",
          y[m],
          {
            "deriv-accordion--compact": a
          },
          g
        ),
        ref: p,
        ...x,
        children: [
          /* @__PURE__ */ v(
            "button",
            {
              className: c(
                "deriv-accordion__header",
                {
                  "deriv-accordion__header--active": e
                },
                _
              ),
              onClick: N,
              "aria-expanded": e,
              type: "button",
              children: [
                typeof t == "string" ? /* @__PURE__ */ r("p", { children: t }) : t,
                /* @__PURE__ */ r(
                  "img",
                  {
                    src: L,
                    className: c("deriv-accordion__icon", {
                      "deriv-accordion__icon--active": e
                    })
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ r(
            "div",
            {
              ref: o,
              style: { maxHeight: w },
              className: c(
                "deriv-accordion__content",
                {
                  "deriv-accordion__content--active": e
                },
                f
              ),
              children: /* @__PURE__ */ r(
                "div",
                {
                  className: c("deriv-accordion__text", {
                    "deriv-accordion__text--compact": a
                  }),
                  children: h
                }
              )
            }
          )
        ]
      }
    );
  }
);
export {
  k as Accordion
};
