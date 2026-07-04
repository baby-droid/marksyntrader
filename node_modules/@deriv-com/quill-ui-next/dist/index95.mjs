import { jsxs, jsx } from "react/jsx-runtime";
import { forwardRef, useState } from "react";
import textStyles from "./index163.mjs";
import checkboxStyles from "./index164.mjs";
import { useFocusHandling } from "./index44.mjs";
import { LabelPairedSquareCheckSmFillIcon, LabelPairedSquareSmBoldIcon } from "@deriv/quill-icons";
const dropdownItemBaseStyles = {
  text: textStyles,
  checkbox: checkboxStyles
};
const DropdownItemAtom = forwardRef(
  ({
    className = "",
    selected = false,
    size = "sm",
    state = "default",
    width = "fill",
    textAlignment = "left",
    label = "Item",
    showFocusRing = false,
    type = "text",
    iconLeft,
    iconRight,
    itemKey = 0,
    onClick,
    value = "",
    noFocus = false
  }, ref) => {
    const styles = dropdownItemBaseStyles[type];
    const itemId = `quill-atom-dropdown-item-${type}-${state}-${size}-selected-${selected}`;
    const [highlight, setHighlight] = useState(showFocusRing);
    const handleClick = () => {
      if (onClick) {
        if (type === "text" && selected) {
          onClick({ label: "", value: "" });
          return false;
        }
        onClick({ label, value, iconLeft, iconRight });
      }
    };
    const { handleFocus, handleBlur } = useFocusHandling({
      isDisabled: state === "disabled",
      setHighlight,
      onEnter: handleClick
    });
    const checkBoxIcon = selected ? /* @__PURE__ */ jsx(LabelPairedSquareCheckSmFillIcon, {}) : /* @__PURE__ */ jsx(LabelPairedSquareSmBoldIcon, {});
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref,
        className: [
          styles.root,
          className,
          "quill-ui-next-atom",
          "quill-ui-next-no-select",
          state !== "disabled" && "quill-ui-next-pointer"
        ].join(" "),
        "data-width": width,
        "data-value": value,
        "data-select": selected,
        "data-id": itemId,
        "data-size": size,
        "data-state": state,
        "data-text-alignment": textAlignment,
        "data-item-key": itemKey,
        "data-item-label": label,
        "data-item-value": value,
        tabIndex: state !== "disabled" && !noFocus ? 0 : -1,
        onFocus: handleFocus,
        onBlur: handleBlur,
        onClick: handleClick,
        children: [
          type === "text" && iconLeft && /* @__PURE__ */ jsx("div", { className: styles.containerIconLeft, children: iconLeft }),
          type === "checkbox" && checkBoxIcon && /* @__PURE__ */ jsx("div", { className: styles.iconCheck, children: checkBoxIcon }),
          /* @__PURE__ */ jsx("div", { className: styles.item, children: label }),
          iconRight && /* @__PURE__ */ jsx("div", { className: styles.containerIconRight, children: iconRight }),
          highlight && /* @__PURE__ */ jsx("div", { className: styles.bgFocus })
        ]
      }
    );
  }
);
export {
  DropdownItemAtom,
  DropdownItemAtom as default
};
//# sourceMappingURL=index95.mjs.map
