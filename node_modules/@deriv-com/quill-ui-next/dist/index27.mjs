import { jsx } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import TextFieldAtom from "./index94.mjs";
import { LabelPairedChevronDownSmBoldIcon } from "@deriv/quill-icons";
import { useClickOutside } from "./index47.mjs";
import { usePortalClick } from "./index52.mjs";
import { DropdownContainerAtom } from "./index111.mjs";
const Dropdown = ({
  className,
  label = "label",
  placeholder = "Select an option",
  message,
  indicator,
  state,
  type,
  size = "md",
  itemSize = "sm",
  textAlignment = "left",
  iconLeft,
  labelLeft,
  isRequired,
  optionalText,
  containerRef,
  selected: internalSelected,
  onChange,
  onClick,
  data = [],
  customValue,
  variant = "labelled",
  autocomplete = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(
    internalSelected
  );
  const [inputValue, setInputValue] = useState(
    (internalSelected == null ? void 0 : internalSelected.label) || ""
  );
  const defaultRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = containerRef || defaultRef;
  useEffect(() => {
    if (internalSelected) {
      setSelected(internalSelected);
      setInputValue(internalSelected.label);
    }
  }, [internalSelected]);
  const getFilteredData = () => {
    if (!autocomplete || !inputValue) {
      return data;
    }
    const searchTerm = inputValue.toLowerCase().trim();
    const results = data.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.label.toLowerCase().includes(searchTerm)
      )
    })).filter((group) => group.items.length > 0);
    if (results.length === 0) {
      return [
        {
          title: "No results found",
          items: []
        }
      ];
    }
    return results;
  };
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
  const handleInputChange = (value) => {
    const newValue = value.toString();
    setInputValue(newValue);
    if (autocomplete && !isOpen) {
      setIsOpen(true);
    }
  };
  const handleItemSelect = (item) => {
    var _a;
    setSelected(item);
    setInputValue(item.label);
    setIsOpen(false);
    (_a = inputRef.current) == null ? void 0 : _a.focus();
    onChange == null ? void 0 : onChange(item);
  };
  useClickOutside(
    dropdownRef,
    () => {
      setIsOpen(false);
    },
    ["quill-ui-next-dropdown-container"]
  );
  return /* @__PURE__ */ jsx(
    TextFieldAtom,
    {
      ref: inputRef,
      containerRef: dropdownRef,
      label,
      placeholder,
      message,
      className: `quill-ui-next-pointer ${className}`,
      allowTyping: autocomplete,
      onClick: (e) => handleClick(e),
      onChange: handleInputChange,
      iconRight: /* @__PURE__ */ jsx(
        LabelPairedChevronDownSmBoldIcon,
        {
          className: `quill-ui-next-rotatable ${isOpen && "quill-ui-next-rotate"}`
        }
      ),
      indicator,
      state,
      type,
      size,
      textAlignment,
      iconLeft: (selected == null ? void 0 : selected.iconLeft) || iconLeft,
      labelLeft,
      isRequired,
      optionalText,
      variant,
      value: autocomplete ? inputValue : customValue || (selected == null ? void 0 : selected.label),
      customContent: /* @__PURE__ */ jsx(
        DropdownContainerAtom,
        {
          width: "100%",
          textAlignment,
          parent: dropdownRef,
          isOpen,
          itemSize,
          data: getFilteredData(),
          containerSize: "md",
          selected,
          onChange: (e) => {
            handleItemSelect(e);
          }
        }
      )
    }
  );
};
export {
  Dropdown,
  Dropdown as default
};
//# sourceMappingURL=index27.mjs.map
