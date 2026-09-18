"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const NotificationDesktopItem_module = require("./index100.cjs");
const NotificationMobileItem_module = require("./index101.cjs");
const index = require("./index17.cjs");
const quillIcons = require("@deriv/quill-icons");
const useHorizontalSwipe = require("./index49.cjs");
const useDevice = require("./index51.cjs");
const useFocusHandling = require("./index44.cjs");
const NotificationItem = ({
  className = "",
  variant = "auto",
  state = "default",
  date = "1 Jan 2023",
  time = "00:00",
  title = "Title",
  message = "Message goes here",
  timeFormat = "UTC",
  showDivider = false,
  showFocusRing = false,
  type = "informative",
  onMarkAsRead,
  onDelete
}) => {
  const { isMobile } = useDevice.useDevice();
  const currentVariant = variant === "auto" ? isMobile ? "mobile" : "desktop" : variant;
  const styles = currentVariant === "desktop" ? NotificationDesktopItem_module.default : NotificationMobileItem_module.default;
  const notificationId = `notification-${currentVariant}-item-${type}`;
  const { isSwiped, resetSwipe, swipeHandlers } = useHorizontalSwipe.useHorizontalSwipe({
    initialState: state === "swipe",
    threshold: 30
  });
  const displayState = isSwiped ? "swipe" : "default";
  const [isRead, setIsRead] = React.useState(false);
  const [focus, setFocus] = React.useState(showFocusRing);
  const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
    isDisabled: false,
    setHighlight: setFocus
  });
  React.useEffect(() => {
    if (state === "default") {
      setIsRead(false);
    }
  }, [state]);
  const handleNotificationClick = (readButton = false) => {
    setIsRead(true);
    if (onMarkAsRead) {
      if (readButton || displayState !== "swipe") {
        onMarkAsRead();
      }
    }
    if (readButton && currentVariant === "mobile") {
      resetSwipe();
    }
  };
  const handleItemClick = () => {
    handleNotificationClick(false);
  };
  if (currentVariant === "desktop") {
    return /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        className: [
          styles.root,
          className,
          "quill-ui-next-pointer",
          "quill-ui-next-component"
        ].join(" "),
        "data-state": state,
        "data-id": notificationId,
        onClick: handleItemClick,
        onFocus: handleFocus,
        onBlur: handleBlur,
        tabIndex: 0,
        children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerStatusbadge, children: /* @__PURE__ */ jsxRuntime.jsx(index.NotificationStatusIcon, { type, showBadge: !isRead }) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.detailsActionButtons, children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.details, children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.titleDescription, children: [
                /* @__PURE__ */ jsxRuntime.jsx("b", { className: styles.title, children: title }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.message, children: message })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.dateTime, children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.date, children: date }),
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.timeTimeFormat, children: [
                  /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.time, children: time }),
                  /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.timeFormat, children: timeFormat })
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.containerActionButtons, children: [
              /* @__PURE__ */ jsxRuntime.jsxs(
                "div",
                {
                  className: styles.buttonMarkAsRead,
                  onClick: () => handleNotificationClick(true),
                  role: onMarkAsRead ? "button" : void 0,
                  tabIndex: onMarkAsRead ? 0 : void 0,
                  children: [
                    /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${styles.icon2} action-button-icon`, children: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCheckMdRegularIcon, {}) }),
                    /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.bgFocus })
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsxs(
                "div",
                {
                  className: styles.buttonDelete,
                  onClick: () => onDelete == null ? void 0 : onDelete(),
                  role: onDelete ? "button" : void 0,
                  tabIndex: onDelete ? 0 : void 0,
                  children: [
                    /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${styles.icon4} action-button-icon`, children: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedTrashSmRegularIcon, {}) }),
                    /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.bgFocus1 })
                  ]
                }
              )
            ] })
          ] }),
          showDivider && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.divider }),
          focus && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.bgFocus2 })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [styles.root, className, "quill-ui-next-pointer"].join(" "),
      "data-state": displayState,
      "data-id": notificationId,
      ...swipeHandlers,
      children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.item, onClick: handleItemClick, children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerStatusbadge, children: /* @__PURE__ */ jsxRuntime.jsx(index.NotificationStatusIcon, { type, showBadge: !isRead }) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.details, children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.titleDescription, children: [
              /* @__PURE__ */ jsxRuntime.jsx("b", { className: styles.title, children: title }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.message, children: message })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.dateTime, children: [
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.date, children: date }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.timeTimeFormat, children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.time, children: time }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.timeFormat, children: timeFormat })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: `${styles.buttonMarkAsRead} quill-ui-next-pointer`,
            onClick: () => {
              if (displayState === "swipe") {
                handleNotificationClick(true);
              }
            },
            role: onMarkAsRead && displayState === "swipe" ? "button" : void 0,
            tabIndex: onMarkAsRead && displayState === "swipe" ? 0 : void 0,
            children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "action-button-icon", children: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCheckMdRegularIcon, {}) })
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: `${styles.buttonDelete} quill-ui-next-pointer`,
            onClick: () => {
              if (displayState === "swipe" && onDelete) {
                onDelete();
                resetSwipe();
              }
            },
            role: onDelete && displayState === "swipe" ? "button" : void 0,
            tabIndex: onDelete && displayState === "swipe" ? 0 : void 0,
            children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "action-button-icon", children: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedTrashSmRegularIcon, {}) })
          }
        ),
        showDivider && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.divider })
      ]
    }
  );
};
exports.NotificationItem = NotificationItem;
exports.default = NotificationItem;
//# sourceMappingURL=index18.cjs.map
