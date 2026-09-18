"use strict";
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const require$$0 = require("react-dom");
const Modal_module = require("./index131.cjs");
const ModalBottom_module = require("./index132.cjs");
const quillIcons = require("@deriv/quill-icons");
const useDevice = require("./index51.cjs");
const useDragToClose = require("./index54.cjs");
const useScrollDisable = require("./index53.cjs");
const index = require("./index36.cjs");
const getStyleForType = (type) => {
  return type === "bottom" ? ModalBottom_module.default : Modal_module.default;
};
const ModalBase = ({
  className = "",
  height = "hug-content",
  description = "Add the content here",
  title = "Title",
  buttonPrimary,
  buttonSecondary,
  show = false,
  type: defaultType = "auto",
  onClose,
  showCloseButton = true,
  showHandleBar = true,
  customIcon,
  customImage,
  content
}) => {
  const [type, setType] = React.useState(defaultType);
  const styles = getStyleForType(type);
  const modalId = `quill-modal-${type}`;
  const { isDesktop, isDeviceDetected } = useDevice.useDevice();
  const { dragHandlers, dragStyles } = useDragToClose.useDragToClose({
    isEnabled: type === "bottom",
    onClose,
    threshold: 150
  });
  useScrollDisable(show);
  React.useEffect(() => {
    if (isDeviceDetected) {
      if (defaultType === "auto") {
        setType(isDesktop ? "overlay" : "bottom");
      } else if (defaultType !== type) {
        setType(defaultType);
      }
    }
  }, [isDesktop, isDeviceDetected, defaultType]);
  const modalContent = /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [
        styles.root,
        className,
        "quill-ui-next-component",
        type === "bottom" ? "quill-ui-next-actionsheet-full-width" : ""
      ].join(" "),
      "data-height": height,
      "data-type": type,
      "data-id": modalId,
      style: dragStyles,
      children: [
        customImage && /* @__PURE__ */ jsxRuntime.jsx("img", { className: styles.containerImage, alt: "", src: customImage }),
        customIcon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerIcon, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.customIcon, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.icon, children: customIcon }) }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.titledescriptioncontent, children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.title, children: title }),
          description && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.description, children: description }),
          content && (type === "bottom" ? /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: `${styles.containerContent} quill-modal-bottom-container`,
              children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "quill-ui-next-modal-bottom-content", children: content })
            }
          ) : /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: `${styles.containerContent} quill-ui-next-modal-content`,
              children: content
            }
          ))
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: type === "bottom" ? styles.containerAction : styles.containerButtons,
            children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.actionButtons, children: [
              buttonPrimary && /* @__PURE__ */ jsxRuntime.jsx(
                index.BasicButton,
                {
                  color: "blackWhite",
                  ...buttonPrimary,
                  style: "primary",
                  width: "fill container"
                }
              ),
              buttonSecondary && /* @__PURE__ */ jsxRuntime.jsx(
                index.BasicButton,
                {
                  color: "blackWhite",
                  ...buttonSecondary,
                  style: "secondary",
                  width: "fill container"
                }
              )
            ] })
          }
        ),
        showCloseButton && type === "overlay" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerButtonClose, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.buttonClose, children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.iconCustom, children: /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: `${styles.icon7} quill-ui-next-pointer`,
              onClick: onClose,
              children: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedXmarkMdBoldIcon, {})
            }
          ) }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.bgFocus2 }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.iconColorReference, children: "Label" })
        ] }) }),
        showHandleBar && type === "bottom" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerHandleBar, ...dragHandlers, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.handleBar }) })
      ]
    }
  );
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose == null ? void 0 : onClose();
    }
  };
  if (!show) {
    return null;
  }
  return require$$0.createPortal(
    /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        className: `quill-ui-next-overlay type-${type}`,
        onClick: handleOverlayClick,
        children: modalContent
      }
    ),
    document.body
  );
};
module.exports = ModalBase;
//# sourceMappingURL=index107.cjs.map
