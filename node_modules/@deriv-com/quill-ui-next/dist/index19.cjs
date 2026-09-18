"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const NotificationBanner_module = require("./index102.cjs");
const quillIcons = require("@deriv/quill-icons");
const index = require("./index17.cjs");
const NotificationBanner = ({
  className = "",
  title = "Title",
  message = "Message goes here",
  showButtonClose = true,
  type = "informative",
  onClose
}) => {
  const bannerId = `notification-banner-${type}`;
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [NotificationBanner_module.default.notificationBanner, className].join(" "),
      "data-id": bannerId,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: NotificationBanner_module.default.containerStatusIcon, children: /* @__PURE__ */ jsxRuntime.jsx(index.NotificationStatusIcon, { type, showBadge: false }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: NotificationBanner_module.default.titleDescription, children: [
          /* @__PURE__ */ jsxRuntime.jsx("b", { className: NotificationBanner_module.default.title, children: title }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: NotificationBanner_module.default.message, children: message })
        ] }),
        showButtonClose && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: NotificationBanner_module.default.buttonClose, children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: `${NotificationBanner_module.default.iconCustom} notification-close-icon quill-ui-next-pointer`,
              onClick: onClose,
              role: onClose ? "button" : void 0,
              tabIndex: onClose ? 0 : void 0,
              children: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedXmarkSmRegularIcon, {})
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: NotificationBanner_module.default.bgFocus }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: NotificationBanner_module.default.iconColorReference, children: "Label" })
        ] })
      ]
    }
  );
};
exports.NotificationBanner = NotificationBanner;
exports.default = NotificationBanner;
//# sourceMappingURL=index19.cjs.map
