"use strict";
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const SegmentedControlSingleChoice_module = require("./index124.cjs");
const SegmentedControlMultiChoice_module = require("./index125.cjs");
const useFocusHandling = require("./index44.cjs");
const SegmentedControlSyles = {
  single: SegmentedControlSingleChoice_module.default,
  multi: SegmentedControlMultiChoice_module.default
};
const SegmentedControlAtom = ({
  className = "",
  size = "sm",
  state: externalState = "default",
  label = "Label",
  icon,
  type = "single",
  value = "",
  isSelected = false,
  onClick
}) => {
  const styles = SegmentedControlSyles[type];
  const [state, setState] = React.useState(externalState);
  const [originalState] = React.useState(externalState);
  const segmentedControlId = `segmented-control-${size}-${state}-${type}`;
  const [focus, setFocus] = React.useState(false);
  const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
    setHighlight: setFocus,
    isDisabled: state === "disabled"
  });
  const handleClick = () => {
    if (state === "disabled") return;
    if (onClick) {
      onClick(value);
    }
    setState("selected");
  };
  React.useEffect(() => {
    setState(externalState);
  }, [externalState]);
  React.useEffect(() => {
    setState(
      isSelected ? "selected" : originalState === "disabled" ? "disabled" : "default"
    );
  }, [isSelected]);
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [
        styles.root,
        className,
        "quill-ui-next-atom",
        "quill-ui-next-no-select",
        label === "" && "quill-ui-next-fit-content",
        state !== "disabled" && "quill-ui-next-pointer"
      ].join(" "),
      "data-id": segmentedControlId,
      "data-size": size,
      "data-state": state,
      tabIndex: state === "disabled" ? -1 : 0,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onClick: handleClick,
      children: [
        icon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.customIcon, children: icon }),
        label && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.label, children: label }),
        focus && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.bgFocus }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: `quill-ui-next-hide ${styles.label}` })
      ]
    }
  );
};
module.exports = SegmentedControlAtom;
//# sourceMappingURL=index71.cjs.map
