"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const BreadcrumbDesktopItem_module = require("./index85.cjs");
const BreadcrumbMobileItem_module = require("./index86.cjs");
const quillIcons = require("@deriv/quill-icons");
const useFocusHandling = require("./index44.cjs");
const Breadcrumb = ({
  className = "",
  variant = "desktop",
  size = "sm",
  state = "default",
  label = "Label",
  showFocusRing = false,
  onClick
}) => {
  const styles = variant === "desktop" ? BreadcrumbDesktopItem_module.default : BreadcrumbMobileItem_module.default;
  const [focus, setFocus] = React.useState(showFocusRing);
  const containerClassName = variant === "desktop" ? styles.containerText : styles.containerLabel;
  const isClickable = state !== "selected" && onClick;
  const breadcrumbId = `quill-breadcrumb-${variant}-${size}-${state}`;
  const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
    isDisabled: !isClickable,
    setHighlight: setFocus
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [styles.root, className].join(" "),
      "data-size": size,
      "data-state": state,
      "data-id": breadcrumbId,
      children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: containerClassName, children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: [
                styles.label,
                isClickable ? "quill-ui-next-pointer" : ""
              ].join(" "),
              onClick: isClickable ? onClick : void 0,
              role: isClickable ? "button" : void 0,
              tabIndex: isClickable ? 0 : void 0,
              onFocus: handleFocus,
              onBlur: handleBlur,
              children: label
            }
          ),
          focus && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.bgFocus })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${styles.iconDivider} breadcrumb-icon`, children: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronRightSmRegularIcon, {}) })
      ]
    }
  );
};
exports.Breadcrumb = Breadcrumb;
exports.default = Breadcrumb;
//# sourceMappingURL=index11.cjs.map
