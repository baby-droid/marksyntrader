"use strict";
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const Chip_module = require("./index145.cjs");
const useFocusHandling = require("./index44.cjs");
const quillIcons = require("@deriv/quill-icons");
const useKeyboardAction = require("./index55.cjs");
const useClickOutside = require("./index47.cjs");
const useActionSheetDetection = require("./index50.cjs");
const index = require("./index111.cjs");
const ChipBase = React.forwardRef(
  ({
    className = "",
    itemSelected = false,
    size = "sm",
    state = "default",
    label = "Label",
    labelTag,
    variant = "dropdown",
    type = "singleSelect",
    icon,
    onClick,
    onChange,
    selected: selectedItems = [],
    options: initialItems = []
  }, ref) => {
    const [highLight, setHighLight] = React.useState(false);
    const [internalState, setInternalState] = React.useState(state);
    const [isSelected, setIsSelected] = React.useState(itemSelected);
    const [isExpanded, setIsExpanded] = React.useState(state === "expand");
    const [items, setItems] = React.useState(initialItems);
    const [selected, setSelected] = React.useState(selectedItems);
    const itemSizes = {
      sm: "sm",
      md: "md",
      lg: "md"
    };
    const itemSize = itemSizes[size];
    const chipRef = React.useRef(null);
    const ChipId = `quill-chip-dropdown-${variant}-${state}-${size}-${isSelected ? "selected" : "unselected"}`;
    const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
      isDisabled: state === "disabled",
      setHighlight: setHighLight
    });
    const { isInsideActionSheet } = useActionSheetDetection.useActionSheetDetection();
    const handleClick = (event) => {
      if (state === "disabled" || variant === "dismissable") return;
      if (event) {
        const target2 = event.target;
        if (isInsideActionSheet(target2)) {
          return;
        }
      }
      const target = event == null ? void 0 : event.target;
      const isClickedOnDropdown = target == null ? void 0 : target.closest(
        ".quill-ui-next-dropdown-container"
      );
      const shouldBehaveLikeSingleSelect = type !== "multiSelect" || !isClickedOnDropdown;
      const isExpanding = shouldBehaveLikeSingleSelect ? internalState !== "expand" : true;
      const isSelected2 = variant === "selectable" ? true : isExpanding;
      setInternalState(isExpanding ? "expand" : "default");
      setIsSelected(isSelected2);
      onClick == null ? void 0 : onClick();
    };
    const handlePress = useKeyboardAction.useKeyboardAction(handleClick);
    const handleClickOutside = () => {
      if (state === "disabled" || variant !== "dropdown") return;
      setIsSelected(false);
    };
    useClickOutside.useClickOutside(chipRef, handleClickOutside);
    React.useEffect(() => {
      setInternalState(state);
    }, [state]);
    React.useEffect(() => {
      setIsExpanded(internalState === "expand");
    }, [internalState]);
    React.useEffect(() => {
      setIsSelected(itemSelected);
    }, [itemSelected]);
    return /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        ref: chipRef,
        className: [
          Chip_module.default.root,
          "quill-ui-next-component",
          "quill-ui-next-no-select",
          state !== "disabled" && "quill-ui-next-pointer",
          className
        ].join(" "),
        "data-id": ChipId,
        "data-itemSelected": isSelected,
        "data-size": size,
        "data-state": internalState,
        tabIndex: state === "disabled" ? -1 : 0,
        onFocus: handleFocus,
        onBlur: handleBlur,
        onClick: handleClick,
        onKeyDown: handlePress,
        children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: Chip_module.default.chip, children: [
            icon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${Chip_module.default.iconLeft} chip-dropdown-icon`, children: icon && icon }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: Chip_module.default.label, children: type === "singleSelect" && selected && !Array.isArray(selected) ? (selected == null ? void 0 : selected.label) || label : label }),
            labelTag && /* @__PURE__ */ jsxRuntime.jsx("b", { className: Chip_module.default.labelTag, children: labelTag }),
            variant === "dropdown" && type === "multiSelect" && Array.isArray(selected) && selected.length > 0 && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: Chip_module.default.counterLabel, children: [
              "(",
              selected.length,
              ")"
            ] }),
            variant === "dropdown" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${Chip_module.default.iconChevron} chip-dropdown-icon`, children: /* @__PURE__ */ jsxRuntime.jsx(
              quillIcons.StandaloneChevronDownBoldIcon,
              {
                className: `quill-ui-next-rotatable ${isExpanded && "quill-ui-next-rotate"}`,
                iconSize: "sm"
              }
            ) }),
            variant === "dismissable" && /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCircleXmarkSmRegularIcon, { className: Chip_module.default.iconClose }),
            highLight && /* @__PURE__ */ jsxRuntime.jsx("div", { className: Chip_module.default.bgFocus })
          ] }),
          variant === "dropdown" && /* @__PURE__ */ jsxRuntime.jsx(
            index.DropdownContainerAtom,
            {
              offsetTop: 5,
              parent: chipRef,
              isOpen: isExpanded,
              data: items,
              multiple: type === "multiSelect",
              containerSize: size,
              itemSize,
              selected,
              onChange: (e) => {
                onChange == null ? void 0 : onChange(e);
                setSelected(e);
                if (type === "singleSelect") {
                  setInternalState("default");
                  setIsSelected(false);
                }
              },
              onActionSheetClose: handleClickOutside
            }
          )
        ]
      }
    );
  }
);
module.exports = ChipBase;
//# sourceMappingURL=index99.cjs.map
