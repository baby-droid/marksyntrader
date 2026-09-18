"use strict";
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const useFocusHandling = require("./index44.cjs");
const BasicButtonBlack_module = require("./index147.cjs");
const BasicButtonWhite_module = require("./index148.cjs");
const BasicButtonCoral_module = require("./index149.cjs");
const BasicButtonBuy_module = require("./index150.cjs");
const BasicButtonSell_module = require("./index151.cjs");
const BasicButtonBlackWhite_module = require("./index152.cjs");
const BasicButtonWhiteBlack_module = require("./index153.cjs");
const BasicButtonGlacier_module = require("./index154.cjs");
const IconButtonBlack_module = require("./index155.cjs");
const IconButtonWhite_module = require("./index156.cjs");
const IconButtonCoral_module = require("./index157.cjs");
const IconButtonBlackWhite_module = require("./index158.cjs");
const IconButtonWhiteBlack_module = require("./index159.cjs");
const LabelPairedCircleInfoSmRegularIcon = require("./index57.cjs");
const LabelPairedLoaderLgRegularIcon = require("./index144.cjs");
const LabelPairedLoaderMdRegularIcon = require("./index143.cjs");
const LabelPairedLoaderSmRegularIcon = require("./index142.cjs");
const LabelPairedLoaderCaptionRegularIcon = require("./index141.cjs");
const buttonStyles = {
  black: BasicButtonBlack_module.default,
  white: BasicButtonWhite_module.default,
  coral: BasicButtonCoral_module.default,
  buy: BasicButtonBuy_module.default,
  sell: BasicButtonSell_module.default,
  blackWhite: BasicButtonBlackWhite_module.default,
  whiteBlack: BasicButtonWhiteBlack_module.default,
  glacier: BasicButtonGlacier_module.default
};
const iconButtonStyles = {
  black: IconButtonBlack_module.default,
  white: IconButtonWhite_module.default,
  coral: IconButtonCoral_module.default,
  blackWhite: IconButtonBlackWhite_module.default,
  whiteBlack: IconButtonWhiteBlack_module.default
};
const BaseButton = ({
  className = "",
  size = "lg",
  state = "default",
  style = "primary",
  width = "hug content",
  color = "coral",
  label = "Label",
  showFocusRing = false,
  iconLeft,
  iconRight,
  icon = /* @__PURE__ */ jsxRuntime.jsx(LabelPairedCircleInfoSmRegularIcon, {}),
  onClick,
  type = "basic"
}) => {
  const styles = type === "basic" ? buttonStyles[color] : iconButtonStyles[color];
  const buttonId = `quill-button-${type}-${state}-${style}-${type}-${size}-${color}`;
  const loaderIcons = {
    sm: LabelPairedLoaderCaptionRegularIcon,
    md: LabelPairedLoaderSmRegularIcon,
    lg: LabelPairedLoaderMdRegularIcon,
    xl: LabelPairedLoaderLgRegularIcon
  };
  const [highlight, setHighlight] = React.useState(showFocusRing);
  const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
    isDisabled: state === "disabled",
    setHighlight
  });
  const renderContent = () => {
    if (state === "loading") {
      const LoaderIcon = loaderIcons[size];
      return /* @__PURE__ */ jsxRuntime.jsxs(
        "div",
        {
          className: [styles.iconLoading, "quill-ui-next-spinner"].join(" "),
          children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.label }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.iconColorReference }),
            LoaderIcon && /* @__PURE__ */ jsxRuntime.jsx(LoaderIcon, {})
          ]
        }
      );
    }
    return type === "icon" ? /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: styles.iconCustom, children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.iconColorReference }),
      icon
    ] }) }) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.iconLeft, children: iconLeft }),
      label && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.label, children: label }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.iconRight, children: iconRight })
    ] });
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "button",
    {
      className: [styles.root, className, "quill-ui-next-component"].join(" "),
      "data-id": buttonId,
      "data-size": size,
      "data-state": state,
      disabled: state === "disabled",
      "data-style": style,
      "data-width": width,
      "data-type": type,
      tabIndex: state === "loading" ? -1 : 0,
      onClick: (e) => state !== "loading" && (onClick == null ? void 0 : onClick(e)),
      onFocus: handleFocus,
      onBlur: handleBlur,
      children: [
        renderContent(),
        highlight && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.bgFocus })
      ]
    }
  );
};
module.exports = BaseButton;
//# sourceMappingURL=index116.cjs.map
