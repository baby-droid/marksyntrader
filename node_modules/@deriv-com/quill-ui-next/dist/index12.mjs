import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import bottomStyles from "./index87.mjs";
import sideStyles from "./index88.mjs";
import { LabelPairedXmarkMdBoldIcon } from "@deriv/quill-icons";
import { SearchField } from "./index24.mjs";
import { useDevice } from "./index51.mjs";
import useScrollDisable from "./index53.mjs";
import { motion, AnimatePresence } from "framer-motion";
import { BasicButton } from "./index36.mjs";
import { IconButton } from "./index35.mjs";
const getStyleForType = (type) => {
  return type === "side" ? sideStyles : bottomStyles;
};
const ActionSheet = ({
  className = "",
  type: defaultType = "auto",
  description = "Description",
  title = "Title",
  showButtonClose = true,
  controller,
  content,
  showHandleBar = true,
  showHeader = true,
  showSearchBar = true,
  buttonPrimary,
  buttonSecondary,
  onClose,
  onSearch,
  searchValue: externalSearchValue,
  searchPlaceholder = "Search",
  buttonIcon,
  show = true
}) => {
  const { isDesktop, isDeviceDetected } = useDevice();
  const [type, setType] = useState(defaultType);
  const [searchValue, setSearchValue] = useState(externalSearchValue || "");
  const styles = getStyleForType(type);
  useEffect(() => {
    if (externalSearchValue !== void 0) {
      setSearchValue(externalSearchValue);
    }
  }, [externalSearchValue]);
  useEffect(() => {
    if (isDeviceDetected) {
      if (defaultType === "auto") {
        setType(isDesktop ? "side" : "bottom");
      } else if (defaultType !== type) {
        setType(defaultType);
      }
    }
  }, [isDesktop, isDeviceDetected, defaultType]);
  useScrollDisable(show);
  if (!show) {
    return null;
  }
  const actionSheetContent = /* @__PURE__ */ jsxs(
    motion.div,
    {
      className: [
        type === "bottom" ? styles.typehugContent : styles.actionSheetSideSheet,
        className,
        type === "side" ? "quill-ui-next-actionsheet-full-height" : "",
        type === "bottom" ? "quill-ui-next-actionsheet-full-width" : ""
      ].join(" "),
      "data-type": type,
      ...type === "bottom" ? {
        initial: { y: "100%" },
        animate: { y: 0 },
        exit: { y: "100%" },
        transition: {
          type: "spring",
          damping: 30,
          stiffness: 1e3,
          mass: 0.1,
          duration: 0.3
        },
        drag: "y",
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0, bottom: 0.5 },
        onDragEnd: (_, info) => {
          if (info.offset.y > 150 && onClose) {
            onClose();
          }
        }
      } : {},
      children: [
        showHandleBar && type === "bottom" && /* @__PURE__ */ jsx("div", { className: styles.containerHandleBar, children: /* @__PURE__ */ jsx("div", { className: styles.handleBar }) }),
        showHeader && /* @__PURE__ */ jsxs("div", { className: styles.containerHeader, children: [
          type === "side" && /* @__PURE__ */ jsxs("div", { className: styles.iconTitleCancel, children: [
            /* @__PURE__ */ jsx("div", { className: styles.containerButtonIcon, children: buttonIcon && /* @__PURE__ */ jsx(
              IconButton,
              {
                ...buttonIcon,
                onClick: onClose,
                color: "blackWhite",
                size: "lg",
                style: "tertiary"
              }
            ) }),
            /* @__PURE__ */ jsx("div", { className: styles.title, children: title }),
            /* @__PURE__ */ jsx("div", { className: styles.containerButtonClose, children: showButtonClose && /* @__PURE__ */ jsx(
              IconButton,
              {
                icon: /* @__PURE__ */ jsx(LabelPairedXmarkMdBoldIcon, {}),
                onClick: onClose,
                color: "blackWhite",
                size: "lg",
                style: "tertiary"
              }
            ) })
          ] }),
          type === "bottom" && /* @__PURE__ */ jsxs("div", { className: styles.titleIcon, children: [
            /* @__PURE__ */ jsx("div", { className: styles.spacer }),
            /* @__PURE__ */ jsx("div", { className: styles.title, children: title }),
            /* @__PURE__ */ jsx("div", { className: styles.containerButtonIcon, children: buttonIcon && /* @__PURE__ */ jsx(
              IconButton,
              {
                ...buttonIcon,
                onClick: onClose,
                color: "blackWhite",
                size: "lg",
                style: "tertiary"
              }
            ) })
          ] }),
          description && /* @__PURE__ */ jsx("div", { className: styles.containerDescription, children: /* @__PURE__ */ jsx("div", { className: styles.description, children: description }) })
        ] }),
        showSearchBar && /* @__PURE__ */ jsx("div", { className: styles.containerSearchBar, children: /* @__PURE__ */ jsx("div", { className: styles.searchBar, children: /* @__PURE__ */ jsx(
          SearchField,
          {
            placeholder: searchPlaceholder,
            value: searchValue,
            onChange: (value) => {
              setSearchValue(value.toString());
              onSearch == null ? void 0 : onSearch(value.toString());
            },
            className: "quill-ui-next-actionsheet-input",
            size: "sm"
          }
        ) }) }),
        controller && /* @__PURE__ */ jsx("div", { className: styles.containerController, children: /* @__PURE__ */ jsx(
          "div",
          {
            className: `${styles.controller} quill-ui-next-actionsheet-content`,
            children: controller
          }
        ) }),
        content && /* @__PURE__ */ jsx(
          "div",
          {
            className: `${styles.containerContent} quill-ui-next-actionsheet-content-container`,
            children: /* @__PURE__ */ jsx(
              "div",
              {
                className: `${styles.content} quill-ui-next-actionsheet-content`,
                children: content
              }
            )
          }
        ),
        (buttonPrimary || buttonSecondary) && /* @__PURE__ */ jsxs("div", { className: styles.actionButtons, children: [
          buttonPrimary && /* @__PURE__ */ jsx(
            BasicButton,
            {
              ...buttonPrimary,
              style: "primary",
              width: "fill container",
              color: "blackWhite"
            }
          ),
          buttonSecondary && /* @__PURE__ */ jsx(
            BasicButton,
            {
              ...buttonSecondary,
              style: "secondary",
              width: "fill container",
              color: "blackWhite"
            }
          )
        ] })
      ]
    }
  );
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose == null ? void 0 : onClose();
    }
  };
  return createPortal(
    /* @__PURE__ */ jsx(AnimatePresence, { mode: "wait", children: /* @__PURE__ */ jsx(
      "div",
      {
        className: `quill-ui-next-overlay type-${type}`,
        onClick: handleOverlayClick,
        children: actionSheetContent
      }
    ) }),
    document.body
  );
};
ActionSheet.displayName = "ActionSheet";
export {
  ActionSheet,
  ActionSheet as default
};
//# sourceMappingURL=index12.mjs.map
