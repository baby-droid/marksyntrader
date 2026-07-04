"use strict";
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index94.cjs");
const quillIcons = require("@deriv/quill-icons");
const useClickOutside = require("./index47.cjs");
const index$1 = require("./index162.cjs");
const usePortalClick = require("./index52.cjs");
const GenericWheelpicker = ({
  className,
  label = "label",
  placeholder = "Select an option",
  message,
  indicator,
  state,
  type,
  size = "md",
  itemSize = "sm",
  itemWidth = "fill",
  textAlignment = "left",
  iconLeft,
  labelLeft,
  isRequired,
  optionalText,
  containerRef,
  selected: internalSelected,
  actionsheet,
  customValue,
  onChange,
  onClick,
  data = [],
  variant = "labelled"
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const defaultRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const dropdownRef = containerRef || defaultRef;
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
    const target = e.target;
    if (target.closest(".wheelpicker-container")) {
      setIsOpen(true);
    } else {
      setIsOpen(!isOpen);
    }
    onClick == null ? void 0 : onClick();
  };
  useClickOutside.useClickOutside(
    dropdownRef,
    () => {
      setIsOpen(false);
    },
    ["wheelpicker-container"]
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
      allowTyping: false,
      onClick: (e) => handleClick(e),
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
      iconLeft,
      labelLeft,
      isRequired,
      optionalText,
      variant,
      value: customValue || (selected == null ? void 0 : selected.map((item) => item.label).join(" ")),
      customContent: /* @__PURE__ */ jsxRuntime.jsx(
        index$1.WheelpickerContainerAtom,
        {
          width: "100%",
          offsetTop: 4,
          textAlignment,
          parent: dropdownRef,
          isOpen,
          itemSize,
          itemWidth,
          data,
          containerSize: "md",
          selected,
          actionsheet: {
            onClose: () => setIsOpen(false),
            ...actionsheet
          },
          onChange: (e) => {
            var _a;
            onChange == null ? void 0 : onChange(e);
            setSelected(e);
            (_a = inputRef.current) == null ? void 0 : _a.focus();
          }
        }
      )
    }
  );
};
GenericWheelpicker.displayName = "GenericWheelpicker";
module.exports = GenericWheelpicker;
//# sourceMappingURL=index118.cjs.map
