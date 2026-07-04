import { jsx } from "react/jsx-runtime";
import { useState, useRef } from "react";
import TextFieldAtom from "./index94.mjs";
import styles from "./index110.mjs";
import { LabelPairedChevronDownSmBoldIcon, LabelPairedMobileNotchLgBoldIcon } from "@deriv/quill-icons";
import { useClickOutside } from "./index47.mjs";
import { DropdownContainerAtom } from "./index111.mjs";
import { usePortalClick } from "./index52.mjs";
const PhoneNumber = ({
  className,
  label = "Phone number",
  labelLeft = "Code",
  labelLeftValue = "+00",
  placeholder = "Select an option",
  message,
  indicator,
  state,
  type,
  size = "md",
  itemSize = "md",
  textAlignment = "left",
  isRequired,
  optionalText,
  containerRef,
  iconRight,
  selected: internalSelected,
  onChange,
  onClick,
  data = [],
  variant = "labelled",
  value
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const defaultRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = containerRef || defaultRef;
  const [code, setCode] = useState("+00");
  const [selected, setSelected] = useState(
    internalSelected
  );
  const handleClick = (e) => {
    const { isPortalClick } = usePortalClick(
      dropdownRef
    );
    if (isPortalClick(e) || state === "disabled") {
      return;
    }
    setIsOpen(!isOpen);
    onClick == null ? void 0 : onClick();
  };
  useClickOutside(dropdownRef, () => setIsOpen(false), [
    "quill-ui-next-dropdown-container"
  ]);
  return /* @__PURE__ */ jsx(
    TextFieldAtom,
    {
      ref: inputRef,
      containerRef: dropdownRef,
      label,
      labelLeft,
      labelLeftValue: code || labelLeftValue,
      placeholder,
      message,
      inputType: "number",
      className: `quill-ui-next-pointer ${styles.root} ${className}`,
      onAddonLeftClick: (e) => {
        var _a;
        (_a = document.activeElement) == null ? void 0 : _a.blur();
        handleClick(e);
      },
      iconLeft: /* @__PURE__ */ jsx(LabelPairedMobileNotchLgBoldIcon, {}),
      iconRight,
      iconLeftSecondary: /* @__PURE__ */ jsx(
        LabelPairedChevronDownSmBoldIcon,
        {
          className: `quill-ui-next-rotatable ${isOpen && "quill-ui-next-rotate"}`
        }
      ),
      isLeftGroup: true,
      indicator,
      state,
      type,
      size,
      textAlignment,
      isRequired,
      optionalText,
      variant,
      value,
      customContent: /* @__PURE__ */ jsx(
        DropdownContainerAtom,
        {
          width: "100%",
          textAlignment,
          parent: dropdownRef,
          isOpen,
          itemSize,
          data,
          containerSize: "md",
          selected,
          onChange: (e) => {
            var _a;
            onChange == null ? void 0 : onChange(e);
            const selectedItem = Array.isArray(e) ? e[0] : e;
            setSelected(selectedItem);
            setCode(selectedItem.value);
            setIsOpen(false);
            (_a = inputRef.current) == null ? void 0 : _a.focus();
          }
        }
      )
    }
  );
};
PhoneNumber.displayName = "PhoneNumber";
export {
  PhoneNumber,
  PhoneNumber as default
};
//# sourceMappingURL=index25.mjs.map
