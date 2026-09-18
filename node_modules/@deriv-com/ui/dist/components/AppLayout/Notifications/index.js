import '../../../assets/index25.css';
import { jsxs as l, jsx as t } from "react/jsx-runtime";
import { useRef as p, Fragment as w } from "react";
import { Notification as v } from "./Notification.js";
import { useDevice as z } from "../../../hooks/useDevice.js";
import { ContextMenu as L } from "../../ContextMenu/index.js";
import { Modal as r } from "../../Modal/index.js";
import { Text as o } from "../../Text/index.js";
import { a as R } from "../../../index-EY1gwl5O.js";
import { c } from "../../../clsx-OuTLNxxd.js";
import { useFetchMore as y } from "../../../hooks/useFetchMore.js";
import { Loader as x } from "../../Loader/index.js";
const b = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3e%3cpath%20fill='var(--fill-color1,%20%23999999)'%20d='M55.744%2011.287a1.605%201.605%200%2000-1.566-.657c-.023-.006-.046-.015-.068-.019L29.683%207.018a1.61%201.61%200%2000-.793.082L9.326%2014.288l-.025.011c-.02.01-.04.022-.062.03a1.677%201.677%200%2000-.65.509c-.005.006-.011.01-.015.016L.312%2026.182c-.316.434-.398%201-.218%201.506.18.508.601.892%201.122%201.026l7.168%201.855v17.765c0%20.714.466%201.345%201.148%201.554l26.248%208.04c.008.004.018%200%20.027.005.14.039.287.064.434.065l.012.002h.001c.155%200%20.306-.028.457-.073.048-.015.092-.035.14-.056.064-.024.127-.041.19-.074L55.875%2047.32c.516-.287.835-.83.835-1.42V28.137l6.37-3.066a1.626%201.626%200%2000.626-2.398l-7.962-11.387zm-26.125-.994l19.066%202.805-12.647%205.895-20.028-3.7%2013.61-5zm-19.028%207.304l22.949%204.239-6.745%2010.143L4.34%2026.167l6.251-8.57zm1.035%2029.535V31.408l15.472%204.004a1.62%201.62%200%20001.754-.672l5.78-8.69v28.128l-23.006-7.046zm41.84-2.19l-15.593%208.672V27.951l2.847%206.065a1.622%201.622%200%20002.167.773l10.578-5.088.002%2015.24zM42.96%2031.15l-4.546-9.681%2015.455-7.203%206.088%208.705L42.96%2031.15z'/%3e%3c/svg%3e", F = ({
  notifications: i,
  clearNotificationsCallback: d = () => {
  },
  isOpen: m,
  setIsOpen: s,
  componentConfig: a,
  className: f,
  excludedClickOutsideClass: M = "",
  loadMoreFunction: T = () => {
  },
  isLoading: _,
  ...h
}) => {
  const { isMobile: N } = z(), n = p(null), u = p(null);
  R(n, (e) => {
    e.stopPropagation(), e.target.className.split(" ").includes(M) || s(!1);
  });
  const { fetchMoreOnBottomReached: g } = y({
    loadMore: T,
    ref: n
  });
  return /* @__PURE__ */ l(w, { children: [
    N && /* @__PURE__ */ l(
      r,
      {
        className: c("notifications", f),
        isOpen: m,
        onRequestClose: () => {
          s(!1);
        },
        ...h,
        children: [
          /* @__PURE__ */ t(
            r.Header,
            {
              onRequestClose: () => {
                s(!1);
              },
              children: /* @__PURE__ */ t(
                o,
                {
                  as: "div",
                  weight: "bold",
                  className: "deriv-modal__header-title",
                  children: a.modalTitle
                }
              )
            }
          ),
          i.length === 0 && /* @__PURE__ */ l("div", { className: "notifications__empty", children: [
            /* @__PURE__ */ t("img", { src: b }),
            /* @__PURE__ */ t(
              o,
              {
                as: "p",
                align: "center",
                className: "notifications__empty-text",
                children: a.noNotificationsTitle
              }
            ),
            /* @__PURE__ */ t(o, { as: "span", align: "center", children: a.noNotificationsMessage })
          ] }),
          /* @__PURE__ */ l(
            "div",
            {
              className: "notifications__content",
              ref: u,
              onScroll: (e) => g(e.target),
              "data-testid": "notifications-content",
              children: [
                i.map((e) => /* @__PURE__ */ t(
                  v,
                  {
                    ...e
                  },
                  e.id
                )),
                _ && /* @__PURE__ */ t("div", { className: "notifications__loader", "data-testid": "notifications-loader", children: /* @__PURE__ */ t(x, { isFullScreen: !1 }) })
              ]
            }
          ),
          /* @__PURE__ */ t(r.Footer, { className: "notifications__footer", children: /* @__PURE__ */ t(
            "button",
            {
              className: c("notifications__footer__clear-button", {
                "notifications__footer__clear-button--disabled": i.length === 0
              }),
              onClick: () => {
                i.length > 0 && (s(!1), d());
              },
              children: a.clearButtonText
            }
          ) })
        ]
      }
    ),
    !N && /* @__PURE__ */ l(
      L,
      {
        ref: n,
        isOpen: m,
        className: c("notifications", f),
        ...h,
        children: [
          /* @__PURE__ */ t(o, { as: "span", className: "notifications__header-desktop", children: a.modalTitle }),
          i.length === 0 && /* @__PURE__ */ l("div", { className: "notifications__empty", children: [
            /* @__PURE__ */ t("img", { src: b }),
            /* @__PURE__ */ t(
              o,
              {
                as: "p",
                align: "center",
                className: "notifications__empty-text",
                children: a.noNotificationsTitle
              }
            ),
            /* @__PURE__ */ t(o, { as: "span", align: "center", children: a.noNotificationsMessage })
          ] }),
          /* @__PURE__ */ l(
            "div",
            {
              className: "notifications__content",
              ref: u,
              onScroll: (e) => g(e.target),
              "data-testid": "notifications-content",
              children: [
                i.map((e) => /* @__PURE__ */ t(
                  v,
                  {
                    ...e
                  },
                  e.id
                )),
                _ && /* @__PURE__ */ t("div", { className: "notifications__loader", "data-testid": "notifications-loader", children: /* @__PURE__ */ t(x, { isFullScreen: !1 }) })
              ]
            }
          ),
          /* @__PURE__ */ t("div", { className: "notifications__footer", children: /* @__PURE__ */ t("div", { className: "notifications__footer-box", children: /* @__PURE__ */ t(
            "button",
            {
              className: c("notifications__footer__clear-button", {
                "notifications__footer__clear-button--disabled": i.length === 0
              }),
              onClick: () => {
                i.length > 0 && d();
              },
              children: a.clearButtonText
            }
          ) }) })
        ]
      }
    )
  ] });
};
F.displayName = "Notifications";
export {
  F as Notifications
};
