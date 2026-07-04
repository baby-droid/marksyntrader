import { jsxs, jsx } from "react/jsx-runtime";
import styles from "./index102.mjs";
import { LabelPairedXmarkSmRegularIcon } from "@deriv/quill-icons";
import { NotificationStatusIcon } from "./index17.mjs";
const NotificationBanner = ({
  className = "",
  title = "Title",
  message = "Message goes here",
  showButtonClose = true,
  type = "informative",
  onClose
}) => {
  const bannerId = `notification-banner-${type}`;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [styles.notificationBanner, className].join(" "),
      "data-id": bannerId,
      children: [
        /* @__PURE__ */ jsx("div", { className: styles.containerStatusIcon, children: /* @__PURE__ */ jsx(NotificationStatusIcon, { type, showBadge: false }) }),
        /* @__PURE__ */ jsxs("div", { className: styles.titleDescription, children: [
          /* @__PURE__ */ jsx("b", { className: styles.title, children: title }),
          /* @__PURE__ */ jsx("div", { className: styles.message, children: message })
        ] }),
        showButtonClose && /* @__PURE__ */ jsxs("div", { className: styles.buttonClose, children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: `${styles.iconCustom} notification-close-icon quill-ui-next-pointer`,
              onClick: onClose,
              role: onClose ? "button" : void 0,
              tabIndex: onClose ? 0 : void 0,
              children: /* @__PURE__ */ jsx(LabelPairedXmarkSmRegularIcon, {})
            }
          ),
          /* @__PURE__ */ jsx("div", { className: styles.bgFocus }),
          /* @__PURE__ */ jsx("div", { className: styles.iconColorReference, children: "Label" })
        ] })
      ]
    }
  );
};
export {
  NotificationBanner,
  NotificationBanner as default
};
//# sourceMappingURL=index19.mjs.map
