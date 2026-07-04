import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useFocusHandling } from "./index44.mjs";
import ButtonBlackStyles from "./index147.mjs";
import ButtonWhiteStyles from "./index148.mjs";
import ButtonCoralStyles from "./index149.mjs";
import ButtonBuyStyles from "./index150.mjs";
import ButtonSellStyles from "./index151.mjs";
import ButtonBlackWhiteStyles from "./index152.mjs";
import ButtonWhiteBlackStyles from "./index153.mjs";
import ButtonGlacierStyles from "./index154.mjs";
import IconButtonBlackStyles from "./index155.mjs";
import IconButtonWhiteStyles from "./index156.mjs";
import IconButtonCoralStyles from "./index157.mjs";
import IconButtonBlackWhiteStyles from "./index158.mjs";
import IconButtonWhiteBlackStyles from "./index159.mjs";
import ForwardRef from "./index57.mjs";
import ForwardRef$1 from "./index144.mjs";
import ForwardRef$2 from "./index143.mjs";
import ForwardRef$3 from "./index142.mjs";
import ForwardRef$4 from "./index141.mjs";
const buttonStyles = {
  black: ButtonBlackStyles,
  white: ButtonWhiteStyles,
  coral: ButtonCoralStyles,
  buy: ButtonBuyStyles,
  sell: ButtonSellStyles,
  blackWhite: ButtonBlackWhiteStyles,
  whiteBlack: ButtonWhiteBlackStyles,
  glacier: ButtonGlacierStyles
};
const iconButtonStyles = {
  black: IconButtonBlackStyles,
  white: IconButtonWhiteStyles,
  coral: IconButtonCoralStyles,
  blackWhite: IconButtonBlackWhiteStyles,
  whiteBlack: IconButtonWhiteBlackStyles
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
  icon = /* @__PURE__ */ jsx(ForwardRef, {}),
  onClick,
  type = "basic"
}) => {
  const styles = type === "basic" ? buttonStyles[color] : iconButtonStyles[color];
  const buttonId = `quill-button-${type}-${state}-${style}-${type}-${size}-${color}`;
  const loaderIcons = {
    sm: ForwardRef$4,
    md: ForwardRef$3,
    lg: ForwardRef$2,
    xl: ForwardRef$1
  };
  const [highlight, setHighlight] = useState(showFocusRing);
  const { handleFocus, handleBlur } = useFocusHandling({
    isDisabled: state === "disabled",
    setHighlight
  });
  const renderContent = () => {
    if (state === "loading") {
      const LoaderIcon = loaderIcons[size];
      return /* @__PURE__ */ jsxs(
        "div",
        {
          className: [styles.iconLoading, "quill-ui-next-spinner"].join(" "),
          children: [
            /* @__PURE__ */ jsx("div", { className: styles.label }),
            /* @__PURE__ */ jsx("div", { className: styles.iconColorReference }),
            LoaderIcon && /* @__PURE__ */ jsx(LoaderIcon, {})
          ]
        }
      );
    }
    return type === "icon" ? /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("div", { className: styles.iconCustom, children: [
      /* @__PURE__ */ jsx("div", { className: styles.iconColorReference }),
      icon
    ] }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: styles.iconLeft, children: iconLeft }),
      label && /* @__PURE__ */ jsx("div", { className: styles.label, children: label }),
      /* @__PURE__ */ jsx("div", { className: styles.iconRight, children: iconRight })
    ] });
  };
  return /* @__PURE__ */ jsxs(
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
        highlight && /* @__PURE__ */ jsx("div", { className: styles.bgFocus })
      ]
    }
  );
};
export {
  BaseButton as default
};
//# sourceMappingURL=index116.mjs.map
