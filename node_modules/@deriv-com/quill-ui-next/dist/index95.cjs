"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const DropdownItemTextAtom_module = require("./index163.cjs");
const DropdownItemCheckboxAtom_module = require("./index164.cjs");
const useFocusHandling = require("./index44.cjs");
const quillIcons = require("@deriv/quill-icons");
const dropdownItemBaseStyles = {
  text: DropdownItemTextAtom_module.default,
  checkbox: DropdownItemCheckboxAtom_module.default
};
const DropdownItemAtom = React.forwardRef(
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
    const [highlight, setHighlight] = React.useState(showFocusRing);
    const handleClick = () => {
      if (onClick) {
        if (type === "text" && selected) {
          onClick({ label: "", value: "" });
          return false;
        }
        onClick({ label, value, iconLeft, iconRight });
      }
    };
    const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
      isDisabled: state === "disabled",
      setHighlight,
      onEnter: handleClick
    });
    const checkBoxIcon = selected ? /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedSquareCheckSmFillIcon, {}) : /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedSquareSmBoldIcon, {});
    return /* @__PURE__ */ jsxRuntime.jsxs(
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
          type === "text" && iconLeft && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerIconLeft, children: iconLeft }),
          type === "checkbox" && checkBoxIcon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.iconCheck, children: checkBoxIcon }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.item, children: label }),
          iconRight && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.containerIconRight, children: iconRight }),
          highlight && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.bgFocus })
        ]
      }
    );
  }
);
exports.DropdownItemAtom = DropdownItemAtom;
exports.default = DropdownItemAtom;
//# sourceMappingURL=index95.cjs.map
