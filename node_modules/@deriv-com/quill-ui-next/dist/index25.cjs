"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index94.cjs");
const PhoneNumber_module = require("./index110.cjs");
const quillIcons = require("@deriv/quill-icons");
const useClickOutside = require("./index47.cjs");
const index$1 = require("./index111.cjs");
const usePortalClick = require("./index52.cjs");
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
  const [isOpen, setIsOpen] = React.useState(false);
  const defaultRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const dropdownRef = containerRef || defaultRef;
  const [code, setCode] = React.useState("+00");
  const [selected, setSelected] = React.useState(
    internalSelected
  );
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
  useClickOutside.useClickOutside(dropdownRef, () => setIsOpen(false), [
    "quill-ui-next-dropdown-container"
  ]);
  return /* @__PURE__ */ jsxRuntime.jsx(
    index,
    {
      ref: inputRef,
      containerRef: dropdownRef,
      label,
      labelLeft,
      labelLeftValue: code || labelLeftValue,
      placeholder,
      message,
      inputType: "number",
      className: `quill-ui-next-pointer ${PhoneNumber_module.default.root} ${className}`,
      onAddonLeftClick: (e) => {
        var _a;
        (_a = document.activeElement) == null ? void 0 : _a.blur();
        handleClick(e);
      },
      iconLeft: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedMobileNotchLgBoldIcon, {}),
      iconRight,
      iconLeftSecondary: /* @__PURE__ */ jsxRuntime.jsx(
        quillIcons.LabelPairedChevronDownSmBoldIcon,
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
      customContent: /* @__PURE__ */ jsxRuntime.jsx(
        index$1.DropdownContainerAtom,
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
exports.PhoneNumber = PhoneNumber;
exports.default = PhoneNumber;
//# sourceMappingURL=index25.cjs.map
