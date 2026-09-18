"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index94.cjs");
const quillIcons = require("@deriv/quill-icons");
const useClickOutside = require("./index47.cjs");
const usePortalClick = require("./index52.cjs");
const index$1 = require("./index111.cjs");
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
  const [isOpen, setIsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState(
    internalSelected
  );
  const [inputValue, setInputValue] = React.useState(
    (internalSelected == null ? void 0 : internalSelected.label) || ""
  );
  const defaultRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const dropdownRef = containerRef || defaultRef;
  React.useEffect(() => {
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
    const { isPortalClick } = usePortalClick.usePortalClick(
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
  useClickOutside.useClickOutside(
    dropdownRef,
    () => {
      setIsOpen(false);
    },
    ["quill-ui-next-dropdown-container"]
  );
  return /* @__PURE__ */ jsxRuntime.jsx(
    index,
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
      iconRight: /* @__PURE__ */ jsxRuntime.jsx(
        quillIcons.LabelPairedChevronDownSmBoldIcon,
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
      customContent: /* @__PURE__ */ jsxRuntime.jsx(
        index$1.DropdownContainerAtom,
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
exports.Dropdown = Dropdown;
exports.default = Dropdown;
//# sourceMappingURL=index27.cjs.map
