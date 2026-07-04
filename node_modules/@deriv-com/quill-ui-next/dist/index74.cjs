"use strict";
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const PaginationButtonAtom_module = require("./index121.cjs");
const PaginationPageAtom_module = require("./index122.cjs");
const PaginationBulletAtom_module = require("./index123.cjs");
const quillIcons = require("@deriv/quill-icons");
const useFocusHandling = require("./index44.cjs");
const paginationAtomStyles = {
  button: PaginationButtonAtom_module.default,
  page: PaginationPageAtom_module.default,
  bullet: PaginationBulletAtom_module.default
};
const PaginationAtom = ({
  className = "",
  state = "default",
  variant = "button",
  icon,
  label = "0",
  onClick
}) => {
  const styles = paginationAtomStyles[variant];
  const paginationAtomId = `pagination-atom-${variant}-${state}`;
  const IconComponent = icon || /* @__PURE__ */ jsxRuntime.jsx(quillIcons.StandalonePlaceholderRegularIcon, { iconSize: "md" });
  const buttonRef = React.useRef(null);
  const [highlight, setHighlight] = React.useState(false);
  const handleClick = () => {
    if (state === "disabled") return;
    onClick == null ? void 0 : onClick();
  };
  const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
    isDisabled: state === "disabled",
    setHighlight,
    onEnter: () => {
      handleClick();
    }
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      ref: buttonRef,
      className: [
        styles.root,
        "quill-ui-next-atom",
        "quill-ui-next-no-select",
        state !== "disabled" && "quill-ui-next-pointer",
        className
      ].join(" "),
      "data-id": paginationAtomId,
      "data-state": state,
      tabIndex: state !== "disabled" ? 0 : -1,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onClick: handleClick,
      children: [
        variant === "button" && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.customIcon, children: IconComponent }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.hiddenLabel })
        ] }),
        variant === "page" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.label, children: label }),
        highlight && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.focus })
      ]
    }
  );
};
PaginationAtom.displayName = "PaginationAtom";
module.exports = PaginationAtom;
//# sourceMappingURL=index74.cjs.map
