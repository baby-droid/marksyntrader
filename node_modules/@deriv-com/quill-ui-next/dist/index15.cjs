"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const SelectionControl_module = require("./index91.cjs");
const quillIcons = require("@deriv/quill-icons");
const useFocusHandling = require("./index44.cjs");
const checkIcons = {
  unchecked: quillIcons.StandaloneSquareBoldIcon,
  checked: quillIcons.StandaloneSquareCheckFillIcon,
  indeterminate: quillIcons.StandaloneSquareMinusFillIcon
};
const radioIcons = {
  unchecked: quillIcons.StandaloneCircleBoldIcon,
  checked: quillIcons.StandaloneCircleDotBoldIcon
};
const infoIcons = {
  sm: quillIcons.LabelPairedCircleInfoSmRegularIcon,
  md: quillIcons.LabelPairedCircleInfoMdRegularIcon
};
const SelectionControl = ({
  className = "",
  size = "sm",
  state = "default",
  indicator = "unchecked",
  label = "label",
  showInfoIcon = true,
  type = "checkbox",
  onChange
}) => {
  const [focus, setFocus] = React.useState(false);
  const [internalIndicator, setInternalIndicator] = React.useState(indicator);
  const checkboxId = `quill-selection-control-checkbox-${state}-${size}-${indicator}`;
  React.useEffect(() => {
    setInternalIndicator(indicator);
    onChange == null ? void 0 : onChange(indicator);
  }, [indicator, onChange]);
  const handleClick = () => {
    if (state === "disabled") return;
    const newIndicator = internalIndicator === "unchecked" ? "checked" : "unchecked";
    setInternalIndicator(newIndicator);
    onChange == null ? void 0 : onChange(newIndicator);
  };
  const CheckIcon = checkIcons[internalIndicator];
  const RadioIcon = radioIcons[internalIndicator];
  const SelectorIcon = type === "checkbox" ? CheckIcon : RadioIcon;
  const InfoIcon = infoIcons[size];
  const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
    isDisabled: state === "disabled",
    setHighlight: setFocus,
    onEnter: () => {
      handleClick();
    }
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [
        SelectionControl_module.default.root,
        className,
        "quill-ui-next-component",
        "quill-ui-next-no-select",
        `${state != "disabled" ? "quill-ui-next-pointer" : ""}`
      ].join(" "),
      "data-id": checkboxId,
      "data-indicator": internalIndicator,
      "data-size": size,
      "data-type": type,
      "data-state": state,
      onClick: handleClick,
      onFocus: handleFocus,
      onBlur: handleBlur,
      role: "checkbox",
      "aria-checked": internalIndicator === "checked",
      tabIndex: state === "disabled" ? -1 : 0,
      children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: SelectionControl_module.default.iconBgFocus, children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: SelectionControl_module.default.iconCheckbox, children: SelectorIcon && /* @__PURE__ */ jsxRuntime.jsx(SelectorIcon, { iconSize: "sm" }) }),
          focus && /* @__PURE__ */ jsxRuntime.jsx("div", { className: SelectionControl_module.default.bgFocus })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: SelectionControl_module.default.label1, children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: SelectionControl_module.default.label, children: label }),
          showInfoIcon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: SelectionControl_module.default.iconInfo, children: /* @__PURE__ */ jsxRuntime.jsx(InfoIcon, {}) })
        ] })
      ]
    }
  );
};
exports.SelectionControl = SelectionControl;
exports.default = SelectionControl;
//# sourceMappingURL=index15.cjs.map
