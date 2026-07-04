"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const ToggleSwitch_module = require("./index92.cjs");
const useFocusHandling = require("./index44.cjs");
const ToggleSwitch = ({
  className = "",
  selected: externalSelected = "off",
  state = "default",
  onChange
}) => {
  const [selected, setSelected] = React.useState(externalSelected);
  const [isFocused, setIsFocused] = React.useState(false);
  const handleClick = () => {
    if (state === "disabled") return;
    setSelected(selected === "off" ? "on" : "off");
    onChange == null ? void 0 : onChange(selected);
  };
  const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
    isDisabled: state === "disabled",
    setHighlight: setIsFocused,
    onEnter: handleClick
  });
  React.useEffect(() => {
    setSelected(externalSelected);
  }, [externalSelected]);
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [ToggleSwitch_module.default.root, className, "quill-ui-next-component"].join(" "),
      "data-selected": selected,
      "data-state": state,
      onClick: handleClick,
      onFocus: handleFocus,
      onBlur: handleBlur,
      tabIndex: state !== "disabled" ? 0 : -1,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: ToggleSwitch_module.default.knob }),
        isFocused && /* @__PURE__ */ jsxRuntime.jsx("div", { className: ToggleSwitch_module.default.bgFocus })
      ]
    }
  );
};
exports.ToggleSwitch = ToggleSwitch;
//# sourceMappingURL=index16.cjs.map
