"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const require$$0 = require("react-dom");
const ActionSheetBottomSheet_module = require("./index87.cjs");
const ActionSheetSideSheet_module = require("./index88.cjs");
const quillIcons = require("@deriv/quill-icons");
const index$1 = require("./index24.cjs");
const useDevice = require("./index51.cjs");
const useScrollDisable = require("./index53.cjs");
const framerMotion = require("framer-motion");
const index$2 = require("./index36.cjs");
const index = require("./index35.cjs");
const getStyleForType = (type) => {
  return type === "side" ? ActionSheetSideSheet_module.default : ActionSheetBottomSheet_module.default;
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
  const { isDesktop, isDeviceDetected } = useDevice.useDevice();
  const [type, setType] = React.useState(defaultType);
  const [searchValue, setSearchValue] = React.useState(externalSearchValue || "");
  const styles = getStyleForType(type);
  React.useEffect(() => {
    if (externalSearchValue !== void 0) {
      setSearchValue(externalSearchValue);
    }
  }, [externalSearchValue]);
  React.useEffect(() => {
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
  const actionSheetContent = /* @__PURE__ */ jsxRuntime.jsxs(
    framerMotion.motion.div,
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
        showHandleBar && type === "bottom" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerHandleBar, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.handleBar }) }),
        showHeader && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.containerHeader, children: [
          type === "side" && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.iconTitleCancel, children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerButtonIcon, children: buttonIcon && /* @__PURE__ */ jsxRuntime.jsx(
              index.IconButton,
              {
                ...buttonIcon,
                onClick: onClose,
                color: "blackWhite",
                size: "lg",
                style: "tertiary"
              }
            ) }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.title, children: title }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerButtonClose, children: showButtonClose && /* @__PURE__ */ jsxRuntime.jsx(
              index.IconButton,
              {
                icon: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedXmarkMdBoldIcon, {}),
                onClick: onClose,
                color: "blackWhite",
                size: "lg",
                style: "tertiary"
              }
            ) })
          ] }),
          type === "bottom" && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.titleIcon, children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.spacer }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.title, children: title }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerButtonIcon, children: buttonIcon && /* @__PURE__ */ jsxRuntime.jsx(
              index.IconButton,
              {
                ...buttonIcon,
                onClick: onClose,
                color: "blackWhite",
                size: "lg",
                style: "tertiary"
              }
            ) })
          ] }),
          description && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerDescription, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.description, children: description }) })
        ] }),
        showSearchBar && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerSearchBar, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.searchBar, children: /* @__PURE__ */ jsxRuntime.jsx(
          index$1.SearchField,
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
        controller && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerController, children: /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: `${styles.controller} quill-ui-next-actionsheet-content`,
            children: controller
          }
        ) }),
        content && /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: `${styles.containerContent} quill-ui-next-actionsheet-content-container`,
            children: /* @__PURE__ */ jsxRuntime.jsx(
              "div",
              {
                className: `${styles.content} quill-ui-next-actionsheet-content`,
                children: content
              }
            )
          }
        ),
        (buttonPrimary || buttonSecondary) && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.actionButtons, children: [
          buttonPrimary && /* @__PURE__ */ jsxRuntime.jsx(
            index$2.BasicButton,
            {
              ...buttonPrimary,
              style: "primary",
              width: "fill container",
              color: "blackWhite"
            }
          ),
          buttonSecondary && /* @__PURE__ */ jsxRuntime.jsx(
            index$2.BasicButton,
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
  return require$$0.createPortal(
    /* @__PURE__ */ jsxRuntime.jsx(framerMotion.AnimatePresence, { mode: "wait", children: /* @__PURE__ */ jsxRuntime.jsx(
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
exports.ActionSheet = ActionSheet;
exports.default = ActionSheet;
//# sourceMappingURL=index12.cjs.map
