import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import SingleChoiceStyles from "./index124.mjs";
import MultiChoiceStyles from "./index125.mjs";
import { useFocusHandling } from "./index44.mjs";
const SegmentedControlSyles = {
  single: SingleChoiceStyles,
  multi: MultiChoiceStyles
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
  const [state, setState] = useState(externalState);
  const [originalState] = useState(externalState);
  const segmentedControlId = `segmented-control-${size}-${state}-${type}`;
  const [focus, setFocus] = useState(false);
  const { handleFocus, handleBlur } = useFocusHandling({
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
  useEffect(() => {
    setState(externalState);
  }, [externalState]);
  useEffect(() => {
    setState(
      isSelected ? "selected" : originalState === "disabled" ? "disabled" : "default"
    );
  }, [isSelected]);
  return /* @__PURE__ */ jsxs(
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
        icon && /* @__PURE__ */ jsx("div", { className: styles.customIcon, children: icon }),
        label && /* @__PURE__ */ jsx("div", { className: styles.label, children: label }),
        focus && /* @__PURE__ */ jsx("div", { className: styles.bgFocus }),
        /* @__PURE__ */ jsx("span", { className: `quill-ui-next-hide ${styles.label}` })
      ]
    }
  );
};
export {
  SegmentedControlAtom as default
};
//# sourceMappingURL=index71.mjs.map
