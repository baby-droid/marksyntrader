import { jsxs as n, jsx as i } from "react/jsx-runtime";
import { Text as a } from "../../Text/index.js";
const l = ({
  icon: c,
  title: e,
  message: s,
  buttonAction: t,
  actionText: o
}) => /* @__PURE__ */ n("div", { className: "notification", children: [
  /* @__PURE__ */ n("div", { className: "notification__container", children: [
    /* @__PURE__ */ i("div", { className: "notification__icon", children: c }),
    /* @__PURE__ */ n("div", { className: "notification__text", children: [
      /* @__PURE__ */ i(
        a,
        {
          as: "h3",
          className: "notification__title",
          children: e
        }
      ),
      /* @__PURE__ */ i("div", { className: "notification__message", children: /* @__PURE__ */ i(a, { as: "p", children: s }) })
    ] })
  ] }),
  typeof t == "function" && typeof o == "string" && /* @__PURE__ */ i("div", { className: "notification__button-container", children: /* @__PURE__ */ i("button", { className: "notification__button", onClick: t, children: o }) })
] });
l.displayName = "Notification";
export {
  l as Notification
};
