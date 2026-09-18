import { jsxs, jsx } from "react/jsx-runtime";
import { forwardRef, useState, useRef, useEffect } from "react";
import styles from "./index145.mjs";
import { useFocusHandling } from "./index44.mjs";
import { StandaloneChevronDownBoldIcon, LabelPairedCircleXmarkSmRegularIcon } from "@deriv/quill-icons";
import { useKeyboardAction } from "./index55.mjs";
import { useClickOutside } from "./index47.mjs";
import { useActionSheetDetection } from "./index50.mjs";
import { DropdownContainerAtom } from "./index111.mjs";
const ChipBase = forwardRef(
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
    const [highLight, setHighLight] = useState(false);
    const [internalState, setInternalState] = useState(state);
    const [isSelected, setIsSelected] = useState(itemSelected);
    const [isExpanded, setIsExpanded] = useState(state === "expand");
    const [items, setItems] = useState(initialItems);
    const [selected, setSelected] = useState(selectedItems);
    const itemSizes = {
      sm: "sm",
      md: "md",
      lg: "md"
    };
    const itemSize = itemSizes[size];
    const chipRef = useRef(null);
    const ChipId = `quill-chip-dropdown-${variant}-${state}-${size}-${isSelected ? "selected" : "unselected"}`;
    const { handleFocus, handleBlur } = useFocusHandling({
      isDisabled: state === "disabled",
      setHighlight: setHighLight
    });
    const { isInsideActionSheet } = useActionSheetDetection();
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
    const handlePress = useKeyboardAction(handleClick);
    const handleClickOutside = () => {
      if (state === "disabled" || variant !== "dropdown") return;
      setIsSelected(false);
    };
    useClickOutside(chipRef, handleClickOutside);
    useEffect(() => {
      setInternalState(state);
    }, [state]);
    useEffect(() => {
      setIsExpanded(internalState === "expand");
    }, [internalState]);
    useEffect(() => {
      setIsSelected(itemSelected);
    }, [itemSelected]);
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref: chipRef,
        className: [
          styles.root,
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
          /* @__PURE__ */ jsxs("div", { className: styles.chip, children: [
            icon && /* @__PURE__ */ jsx("div", { className: `${styles.iconLeft} chip-dropdown-icon`, children: icon && icon }),
            /* @__PURE__ */ jsx("div", { className: styles.label, children: type === "singleSelect" && selected && !Array.isArray(selected) ? (selected == null ? void 0 : selected.label) || label : label }),
            labelTag && /* @__PURE__ */ jsx("b", { className: styles.labelTag, children: labelTag }),
            variant === "dropdown" && type === "multiSelect" && Array.isArray(selected) && selected.length > 0 && /* @__PURE__ */ jsxs("div", { className: styles.counterLabel, children: [
              "(",
              selected.length,
              ")"
            ] }),
            variant === "dropdown" && /* @__PURE__ */ jsx("div", { className: `${styles.iconChevron} chip-dropdown-icon`, children: /* @__PURE__ */ jsx(
              StandaloneChevronDownBoldIcon,
              {
                className: `quill-ui-next-rotatable ${isExpanded && "quill-ui-next-rotate"}`,
                iconSize: "sm"
              }
            ) }),
            variant === "dismissable" && /* @__PURE__ */ jsx(LabelPairedCircleXmarkSmRegularIcon, { className: styles.iconClose }),
            highLight && /* @__PURE__ */ jsx("div", { className: styles.bgFocus })
          ] }),
          variant === "dropdown" && /* @__PURE__ */ jsx(
            DropdownContainerAtom,
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
export {
  ChipBase as default
};
//# sourceMappingURL=index99.mjs.map
