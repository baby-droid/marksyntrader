import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import styles from "./index92.mjs";
import { useFocusHandling } from "./index44.mjs";
const ToggleSwitch = ({
  className = "",
  selected: externalSelected = "off",
  state = "default",
  onChange
}) => {
  const [selected, setSelected] = useState(externalSelected);
  const [isFocused, setIsFocused] = useState(false);
  const handleClick = () => {
    if (state === "disabled") return;
    setSelected(selected === "off" ? "on" : "off");
    onChange == null ? void 0 : onChange(selected);
  };
  const { handleFocus, handleBlur } = useFocusHandling({
    isDisabled: state === "disabled",
    setHighlight: setIsFocused,
    onEnter: handleClick
  });
  useEffect(() => {
    setSelected(externalSelected);
  }, [externalSelected]);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [styles.root, className, "quill-ui-next-component"].join(" "),
      "data-selected": selected,
      "data-state": state,
      onClick: handleClick,
      onFocus: handleFocus,
      onBlur: handleBlur,
      tabIndex: state !== "disabled" ? 0 : -1,
      children: [
        /* @__PURE__ */ jsx("div", { className: styles.knob }),
        isFocused && /* @__PURE__ */ jsx("div", { className: styles.bgFocus })
      ]
    }
  );
};
export {
  ToggleSwitch
};
//# sourceMappingURL=index16.mjs.map
