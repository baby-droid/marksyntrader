import { jsx } from "react/jsx-runtime";
import { useState, useRef } from "react";
import TextFieldAtom from "./index94.mjs";
import { LabelPairedChevronDownSmBoldIcon } from "@deriv/quill-icons";
import { useClickOutside } from "./index47.mjs";
import { WheelpickerContainerAtom } from "./index162.mjs";
import { usePortalClick } from "./index52.mjs";
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
  const [isOpen, setIsOpen] = useState(false);
  const defaultRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = containerRef || defaultRef;
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
    const target = e.target;
    if (target.closest(".wheelpicker-container")) {
      setIsOpen(true);
    } else {
      setIsOpen(!isOpen);
    }
    onClick == null ? void 0 : onClick();
  };
  useClickOutside(
    dropdownRef,
    () => {
      setIsOpen(false);
    },
    ["wheelpicker-container"]
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
      allowTyping: false,
      onClick: (e) => handleClick(e),
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
      iconLeft,
      labelLeft,
      isRequired,
      optionalText,
      variant,
      value: customValue || (selected == null ? void 0 : selected.map((item) => item.label).join(" ")),
      customContent: /* @__PURE__ */ jsx(
        WheelpickerContainerAtom,
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
export {
  GenericWheelpicker as default
};
//# sourceMappingURL=index118.mjs.map
