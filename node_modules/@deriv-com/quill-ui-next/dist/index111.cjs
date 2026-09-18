"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const framerMotion = require("framer-motion");
const index$2 = require("./index95.cjs");
const DropdownContainerAtom_module = require("./index139.cjs");
const index$1 = require("./index140.cjs");
const useDevice = require("./index51.cjs");
const index = require("./index12.cjs");
const dropdownVariants = {
  hidden: {
    opacity: 0,
    transition: { duration: 0.2 }
  },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 }
  }
};
const DropdownContainerAtom = ({
  className = "",
  containerSize = "default",
  width = "200px",
  parent,
  isOpen = false,
  data = [],
  itemSize = "sm",
  multiple = false,
  selected: selectedItems = [],
  offsetTop = 5,
  textAlignment = "left",
  onChange,
  onActionSheetClose,
  actionSheet,
  customContent
}) => {
  const { isDesktop } = useDevice.useDevice();
  const containerRef = React.useRef(null);
  const [topPosition, setTopPosition] = React.useState(0);
  const [isScrollable, setIsScrollable] = React.useState(false);
  const [selected, setSelected] = React.useState(selectedItems);
  let height;
  if (containerSize === "sm") {
    height = "220px";
  } else if (containerSize === "md") {
    height = "440px";
  } else if (containerSize === "lg") {
    height = "660px";
  } else if (containerSize === "default") {
    height = "unset";
  }
  const dropdownContainerStyle = React.useMemo(() => {
    return {
      overflowY: isScrollable ? "scroll" : "hidden",
      maxHeight: height,
      width,
      top: `${topPosition}px`
    };
  }, [height, topPosition]);
  React.useEffect(() => {
    setIsScrollable(containerSize !== "default");
  }, [containerSize]);
  React.useEffect(() => {
    if (parent.current && isOpen) {
      const elementHeight = parent.current.getBoundingClientRect().height + offsetTop;
      setTopPosition(elementHeight);
    }
  }, [parent, isOpen]);
  React.useEffect(() => {
    if (!containerRef.current || !selected) return;
    const scrollToSelected = () => {
      var _a;
      if (!selected || Array.isArray(selected) && selected.length === 0)
        return;
      const selectedItem = Array.isArray(selected) ? selected[0] : selected;
      const selectedElement = (_a = containerRef.current) == null ? void 0 : _a.querySelector(
        `[data-value="${selectedItem.value}"]`
      );
      if (selectedElement && containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const elementOffset = selectedElement.getBoundingClientRect().top - containerRef.current.getBoundingClientRect().top + 100;
        containerRef.current.scrollTop = elementOffset - containerHeight / 2;
      }
    };
    setTimeout(() => {
      scrollToSelected();
    }, 100);
  }, [isOpen]);
  const defaultRenderItem = ({
    label,
    value,
    iconLeft,
    iconRight
  }) => {
    const isItemSelected = multiple ? Array.isArray(selected) && selected.some((item) => item.value === value) : !Array.isArray(selected) && (selected == null ? void 0 : selected.value) === value;
    return /* @__PURE__ */ jsxRuntime.jsx(
      index$2.DropdownItemAtom,
      {
        size: itemSize,
        label,
        value,
        type: multiple ? "checkbox" : "text",
        textAlignment,
        onClick: (e) => {
          if (multiple) {
            const newSelected = Array.isArray(selected) ? [...selected] : [];
            const existingIndex = newSelected.findIndex(
              (item) => item.value === value
            );
            if (existingIndex >= 0) {
              newSelected.splice(existingIndex, 1);
            } else {
              newSelected.push({ label, value });
            }
            setSelected(newSelected);
            onChange == null ? void 0 : onChange(newSelected);
          } else {
            setSelected(e);
            onChange == null ? void 0 : onChange(e);
          }
        },
        selected: isItemSelected,
        iconLeft,
        iconRight
      },
      `item-${label}-${value}`
    );
  };
  const renderDropdownContent = () => {
    if (customContent) {
      return customContent;
    }
    return /* @__PURE__ */ jsxRuntime.jsx("div", { className: DropdownContainerAtom_module.default.listItems, children: data == null ? void 0 : data.map(({ title, items }, key) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: DropdownContainerAtom_module.default.group1, children: [
      title && /* @__PURE__ */ jsxRuntime.jsx(index$1, { title }),
      items.length > 0 && items.map((item) => defaultRenderItem(item)),
      title && /* @__PURE__ */ jsxRuntime.jsx("div", { className: DropdownContainerAtom_module.default.divider })
    ] }, key)) });
  };
  return isOpen && (data.length > 0 || customContent) && /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: isDesktop ? /* @__PURE__ */ jsxRuntime.jsx(framerMotion.AnimatePresence, { children: /* @__PURE__ */ jsxRuntime.jsx(
    framerMotion.motion.div,
    {
      ref: containerRef,
      className: [
        DropdownContainerAtom_module.default.inputsDropdownListChe,
        "quill-ui-next-dropdown-container",
        className
      ].join(" "),
      style: dropdownContainerStyle,
      initial: "hidden",
      animate: "visible",
      exit: "hidden",
      variants: dropdownVariants,
      children: renderDropdownContent()
    }
  ) }) : /* @__PURE__ */ jsxRuntime.jsx(
    index.ActionSheet,
    {
      ...actionSheet,
      show: isOpen,
      showHeader: false,
      showSearchBar: false,
      content: renderDropdownContent(),
      onClose: () => {
        onChange == null ? void 0 : onChange(
          Array.isArray(selected) ? selected : selected || { label: "", value: "" }
        );
        onActionSheetClose == null ? void 0 : onActionSheetClose();
      },
      type: "bottom"
    }
  ) });
};
exports.DropdownContainerAtom = DropdownContainerAtom;
exports.default = DropdownContainerAtom;
//# sourceMappingURL=index111.cjs.map
