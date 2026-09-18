import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import modalStyle from "./index131.mjs";
import modalBottomStyle from "./index132.mjs";
import { LabelPairedXmarkMdBoldIcon } from "@deriv/quill-icons";
import { useDevice } from "./index51.mjs";
import { useDragToClose } from "./index54.mjs";
import useScrollDisable from "./index53.mjs";
import { BasicButton } from "./index36.mjs";
const getStyleForType = (type) => {
  return type === "bottom" ? modalBottomStyle : modalStyle;
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
  const [type, setType] = useState(defaultType);
  const styles = getStyleForType(type);
  const modalId = `quill-modal-${type}`;
  const { isDesktop, isDeviceDetected } = useDevice();
  const { dragHandlers, dragStyles } = useDragToClose({
    isEnabled: type === "bottom",
    onClose,
    threshold: 150
  });
  useScrollDisable(show);
  useEffect(() => {
    if (isDeviceDetected) {
      if (defaultType === "auto") {
        setType(isDesktop ? "overlay" : "bottom");
      } else if (defaultType !== type) {
        setType(defaultType);
      }
    }
  }, [isDesktop, isDeviceDetected, defaultType]);
  const modalContent = /* @__PURE__ */ jsxs(
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
        customImage && /* @__PURE__ */ jsx("img", { className: styles.containerImage, alt: "", src: customImage }),
        customIcon && /* @__PURE__ */ jsx("div", { className: styles.containerIcon, children: /* @__PURE__ */ jsx("div", { className: styles.customIcon, children: /* @__PURE__ */ jsx("div", { className: styles.icon, children: customIcon }) }) }),
        /* @__PURE__ */ jsxs("div", { className: styles.titledescriptioncontent, children: [
          /* @__PURE__ */ jsx("div", { className: styles.title, children: title }),
          description && /* @__PURE__ */ jsx("div", { className: styles.description, children: description }),
          content && (type === "bottom" ? /* @__PURE__ */ jsx(
            "div",
            {
              className: `${styles.containerContent} quill-modal-bottom-container`,
              children: /* @__PURE__ */ jsx("div", { className: "quill-ui-next-modal-bottom-content", children: content })
            }
          ) : /* @__PURE__ */ jsx(
            "div",
            {
              className: `${styles.containerContent} quill-ui-next-modal-content`,
              children: content
            }
          ))
        ] }),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: type === "bottom" ? styles.containerAction : styles.containerButtons,
            children: /* @__PURE__ */ jsxs("div", { className: styles.actionButtons, children: [
              buttonPrimary && /* @__PURE__ */ jsx(
                BasicButton,
                {
                  color: "blackWhite",
                  ...buttonPrimary,
                  style: "primary",
                  width: "fill container"
                }
              ),
              buttonSecondary && /* @__PURE__ */ jsx(
                BasicButton,
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
        showCloseButton && type === "overlay" && /* @__PURE__ */ jsx("div", { className: styles.containerButtonClose, children: /* @__PURE__ */ jsxs("div", { className: styles.buttonClose, children: [
          /* @__PURE__ */ jsx("div", { className: styles.iconCustom, children: /* @__PURE__ */ jsx(
            "div",
            {
              className: `${styles.icon7} quill-ui-next-pointer`,
              onClick: onClose,
              children: /* @__PURE__ */ jsx(LabelPairedXmarkMdBoldIcon, {})
            }
          ) }),
          /* @__PURE__ */ jsx("div", { className: styles.bgFocus2 }),
          /* @__PURE__ */ jsx("div", { className: styles.iconColorReference, children: "Label" })
        ] }) }),
        showHandleBar && type === "bottom" && /* @__PURE__ */ jsx("div", { className: styles.containerHandleBar, ...dragHandlers, children: /* @__PURE__ */ jsx("div", { className: styles.handleBar }) })
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
  return createPortal(
    /* @__PURE__ */ jsx(
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
export {
  ModalBase as default
};
//# sourceMappingURL=index107.mjs.map
