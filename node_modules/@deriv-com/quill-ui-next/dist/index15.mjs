import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import styles from "./index91.mjs";
import { StandaloneSquareMinusFillIcon, StandaloneSquareCheckFillIcon, StandaloneSquareBoldIcon, StandaloneCircleDotBoldIcon, StandaloneCircleBoldIcon, LabelPairedCircleInfoMdRegularIcon, LabelPairedCircleInfoSmRegularIcon } from "@deriv/quill-icons";
import { useFocusHandling } from "./index44.mjs";
const checkIcons = {
  unchecked: StandaloneSquareBoldIcon,
  checked: StandaloneSquareCheckFillIcon,
  indeterminate: StandaloneSquareMinusFillIcon
};
const radioIcons = {
  unchecked: StandaloneCircleBoldIcon,
  checked: StandaloneCircleDotBoldIcon
};
const infoIcons = {
  sm: LabelPairedCircleInfoSmRegularIcon,
  md: LabelPairedCircleInfoMdRegularIcon
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
  const [focus, setFocus] = useState(false);
  const [internalIndicator, setInternalIndicator] = useState(indicator);
  const checkboxId = `quill-selection-control-checkbox-${state}-${size}-${indicator}`;
  useEffect(() => {
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
  const { handleFocus, handleBlur } = useFocusHandling({
    isDisabled: state === "disabled",
    setHighlight: setFocus,
    onEnter: () => {
      handleClick();
    }
  });
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [
        styles.root,
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
        /* @__PURE__ */ jsxs("div", { className: styles.iconBgFocus, children: [
          /* @__PURE__ */ jsx("div", { className: styles.iconCheckbox, children: SelectorIcon && /* @__PURE__ */ jsx(SelectorIcon, { iconSize: "sm" }) }),
          focus && /* @__PURE__ */ jsx("div", { className: styles.bgFocus })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: styles.label1, children: [
          /* @__PURE__ */ jsx("div", { className: styles.label, children: label }),
          showInfoIcon && /* @__PURE__ */ jsx("div", { className: styles.iconInfo, children: /* @__PURE__ */ jsx(InfoIcon, {}) })
        ] })
      ]
    }
  );
};
export {
  SelectionControl,
  SelectionControl as default
};
//# sourceMappingURL=index15.mjs.map
