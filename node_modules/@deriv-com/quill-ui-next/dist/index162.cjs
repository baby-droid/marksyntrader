"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const framerMotion = require("framer-motion");
const index$1 = require("./index95.cjs");
const DropdownContainerAtom_module = require("./index139.cjs");
const useDevice = require("./index51.cjs");
const index = require("./index12.cjs");
const dropdownVariants = {
  hidden: {
    opacity: 0,
    maxHeight: 0,
    transition: { duration: 0.2 },
    display: "none"
  },
  visible: {
    opacity: 1,
    maxHeight: "500px",
    transition: { duration: 0.2 },
    display: "block"
  }
};
function scrollListContainerToItem(listContainer, itemIdx, itemSize = "sm") {
  const itemHeight = itemSize === "sm" ? 32 : 48;
  listContainer.scrollTo({
    top: itemHeight * itemIdx,
    behavior: "smooth"
  });
}
const WheelpickerContainerAtom = ({
  className = "",
  width = "200px",
  parent,
  isOpen = false,
  data = [],
  itemSize = "sm",
  itemWidth = "fill",
  selected: selectedItems = [],
  offsetTop = 0,
  textAlignment = "left",
  onChange,
  actionsheet,
  customContent
}) => {
  const { isDesktop } = useDevice.useDevice();
  const containerRef = React.useRef(null);
  const [topPosition, setTopPosition] = React.useState(0);
  const [isMounted, setIsMounted] = React.useState(false);
  const [selected, setSelected] = React.useState(selectedItems);
  const wheelpickerRef = React.useRef(null);
  const activeContainerRef = React.useRef(null);
  const lastSelectedRef = React.useRef([]);
  const centerCheckIntervalRef = React.useRef(null);
  let height;
  if (itemSize === "sm") {
    height = "177px";
  } else if (itemSize === "md") {
    height = "258px";
  }
  const dropdownContainerStyle = React.useMemo(() => {
    return {
      overflow: "hidden",
      maxHeight: height,
      width,
      top: `${topPosition}px`
    };
  }, [height, topPosition]);
  React.useEffect(() => {
    if (parent.current && isOpen) {
      const elementHeight = parent.current.getBoundingClientRect().height + offsetTop;
      setTopPosition(elementHeight);
    }
  }, [parent, isOpen]);
  React.useEffect(() => {
    if (selected && Array.isArray(selected) && isOpen && !isMounted) {
      setTimeout(() => {
        setIsMounted(true);
      }, 300);
      setTimeout(() => {
        selected.forEach((item, index2) => {
          var _a, _b;
          const itemIdx = (_b = (_a = data[index2]) == null ? void 0 : _a.items) == null ? void 0 : _b.findIndex(
            (i) => i.value === item.value
          );
          if (itemIdx !== void 0 && itemIdx >= 0) {
            const listContainer = document.querySelector(
              `.wheelpicker-container-list[data-list-index="${index2}"]`
            );
            if (listContainer) {
              scrollListContainerToItem(listContainer, itemIdx, itemSize);
            }
          }
        });
      }, 10);
    }
  }, [selected, isOpen]);
  const handleListNavigation = (eventOrKey) => {
    if (!isOpen || !activeContainerRef.current) return;
    const container = activeContainerRef.current;
    const itemHeight = itemSize === "sm" ? 32 : 48;
    let key;
    let preventDefault = () => {
    };
    if (typeof eventOrKey === "string") {
      key = eventOrKey;
    } else {
      key = eventOrKey.key;
      preventDefault = () => eventOrKey.preventDefault();
    }
    switch (key) {
      case "ArrowUp":
        preventDefault();
        container.scrollBy({ top: -itemHeight, behavior: "smooth" });
        break;
      case "ArrowDown":
        preventDefault();
        container.scrollBy({ top: itemHeight, behavior: "smooth" });
        break;
      case "PageUp":
        preventDefault();
        container.scrollBy({ top: -itemHeight * 5, behavior: "smooth" });
        break;
      case "PageDown":
        preventDefault();
        container.scrollBy({ top: itemHeight * 5, behavior: "smooth" });
        break;
      case "ArrowLeft":
        preventDefault();
        moveActiveContainer("left");
        break;
      case "ArrowRight":
        preventDefault();
        moveActiveContainer("right");
        break;
    }
  };
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      handleListNavigation(e);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeContainerRef]);
  const defaultRenderItem = ({
    label,
    value,
    iconLeft,
    iconRight,
    className: className2,
    itemKey,
    state = "default"
  }, listContainer) => {
    const isItemSelected = !Array.isArray(selected) && (selected == null ? void 0 : selected.value) === value;
    console.log({ textAlignment });
    return /* @__PURE__ */ jsxRuntime.jsx(
      index$1.DropdownItemAtom,
      {
        className: className2,
        size: itemSize,
        width: itemWidth,
        label,
        value,
        type: "text",
        textAlignment,
        state,
        itemKey,
        selected: isItemSelected,
        onClick: () => {
          const container = document.querySelector(listContainer);
          if (container instanceof HTMLDivElement && itemKey !== void 0) {
            scrollListContainerToItem(container, itemKey, itemSize);
          }
        },
        iconLeft,
        iconRight
      },
      `item-${label}-${value}`
    );
  };
  const startCenterCheckInterval = () => {
    centerCheckIntervalRef.current = setInterval(() => {
      var _a;
      const containers = (_a = wheelpickerRef.current) == null ? void 0 : _a.querySelectorAll(
        ".wheelpicker-container-list"
      );
      if (containers) {
        containers.forEach((container) => {
          const items = Array.from(container.getElementsByClassName("active-item"));
          const containerRect = container.getBoundingClientRect();
          const containerCenter = containerRect.top + containerRect.height / 2;
          let closestItem = null;
          let minDistance = Infinity;
          items.forEach((item) => {
            const rect = item.getBoundingClientRect();
            const itemCenter = rect.top + rect.height / 2;
            const distance = Math.abs(itemCenter - containerCenter);
            if (distance < minDistance) {
              minDistance = distance;
              closestItem = item;
            }
          });
          if (closestItem) {
            items.forEach((sibling) => {
              const desiredState = sibling === closestItem ? "default" : "disabled";
              if (sibling.getAttribute("data-state") !== desiredState) {
                sibling.setAttribute("data-state", desiredState);
              }
            });
          }
        });
        const newSelected = Array.from(containers).map((container) => {
          const items = Array.from(container.getElementsByClassName("active-item"));
          const containerRect = container.getBoundingClientRect();
          const containerCenter = containerRect.top + containerRect.height / 2;
          let closestItem = null;
          let minDistance = Infinity;
          items.forEach((item) => {
            const rect = item.getBoundingClientRect();
            const itemCenter = rect.top + rect.height / 2;
            const distance = Math.abs(itemCenter - containerCenter);
            if (distance < minDistance) {
              minDistance = distance;
              closestItem = item;
            }
          });
          if (closestItem) {
            return {
              label: closestItem.getAttribute(
                "data-item-label"
              ) || "",
              value: closestItem.getAttribute(
                "data-item-value"
              ) || ""
            };
          }
          return void 0;
        }).filter(
          (item) => Boolean(item)
        );
        const isEqual = lastSelectedRef.current.length === newSelected.length && lastSelectedRef.current.every(
          (item, idx) => item.label === newSelected[idx].label && item.value === newSelected[idx].value
        );
        if (!isEqual && newSelected.length > 0) {
          setSelected(newSelected);
          lastSelectedRef.current = newSelected;
          const hasNonEmpty = newSelected.some(
            (item) => item.label !== "" || item.value !== ""
          );
          if (onChange && hasNonEmpty) {
            onChange(newSelected);
          }
        }
      }
    }, 10);
    return () => {
      if (centerCheckIntervalRef.current) {
        clearInterval(centerCheckIntervalRef.current);
        centerCheckIntervalRef.current = null;
      }
    };
  };
  const renderDropdownContent = () => {
    if (customContent) {
      return customContent;
    } else {
      return /* @__PURE__ */ jsxRuntime.jsx(
        "div",
        {
          className: `${DropdownContainerAtom_module.default.wheelpickerContainer} wheelpicker-container`,
          "data-size": itemSize,
          ref: wheelpickerRef,
          children: data == null ? void 0 : data.map(({ items, extra }, key) => /* @__PURE__ */ jsxRuntime.jsxs(
            "div",
            {
              "data-size": itemSize,
              "data-list-index": key,
              className: `${DropdownContainerAtom_module.default.wheelpickerList} wheelpicker-container-list wheelpicker-container-list-${key}`,
              onMouseOver: (e) => {
                const target = e.currentTarget;
                if (target !== activeContainerRef.current) {
                  activeContainerRef.current = target;
                }
              },
              children: [
                extra && /* @__PURE__ */ jsxRuntime.jsx("span", { className: `item-list-extra ${DropdownContainerAtom_module.default.itemListExtra}`, children: extra }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  index$1.DropdownItemAtom,
                  {
                    className: DropdownContainerAtom_module.default.wheelpickerItem,
                    size: itemSize,
                    label: "",
                    noFocus: true,
                    width: itemWidth
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  index$1.DropdownItemAtom,
                  {
                    size: itemSize,
                    label: "",
                    className: DropdownContainerAtom_module.default.wheelpickerItem,
                    noFocus: true,
                    width: itemWidth
                  }
                ),
                items.length > 0 && items.map(
                  (item, itemKey) => defaultRenderItem(
                    {
                      ...item,
                      className: `${DropdownContainerAtom_module.default.wheelpickerItem} active-item`,
                      itemKey
                    },
                    `.wheelpicker-container-list-${key}`
                  )
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  index$1.DropdownItemAtom,
                  {
                    size: itemSize,
                    label: "",
                    className: DropdownContainerAtom_module.default.wheelpickerItem,
                    noFocus: true,
                    width: itemWidth
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  index$1.DropdownItemAtom,
                  {
                    size: itemSize,
                    label: "",
                    className: DropdownContainerAtom_module.default.wheelpickerItem,
                    width: itemWidth
                  }
                )
              ]
            },
            key
          ))
        }
      );
    }
  };
  React.useEffect(() => {
    if (isMounted) {
      const stopInterval = startCenterCheckInterval();
      return () => {
        stopInterval();
      };
    }
  }, [isMounted]);
  React.useEffect(() => {
    if (!isOpen) {
      if (centerCheckIntervalRef.current) {
        clearInterval(centerCheckIntervalRef.current);
        centerCheckIntervalRef.current = null;
        setIsMounted(false);
      }
    }
  }, [isOpen]);
  React.useEffect(() => {
    const containers = document.querySelectorAll(
      ".wheelpicker-container-list"
    );
    const handleNativeWheel = (e) => {
      const container = e.currentTarget;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isScrollingDown = e.deltaY > 0;
      if (isScrollingDown && scrollTop + clientHeight >= scrollHeight || !isScrollingDown && scrollTop <= 0) {
        e.preventDefault();
      }
    };
    containers.forEach((container) => {
      container.addEventListener("wheel", handleNativeWheel, {
        passive: false
      });
    });
    return () => {
      containers.forEach((container) => {
        container.removeEventListener("wheel", handleNativeWheel);
      });
    };
  }, [isMounted]);
  const moveActiveContainer = (direction) => {
    var _a;
    if (!activeContainerRef.current) return;
    let sibling = direction === "left" ? activeContainerRef.current.previousElementSibling : activeContainerRef.current.nextElementSibling;
    while (sibling && !sibling.classList.contains("wheelpicker-container-list")) {
      sibling = direction === "left" ? sibling.previousElementSibling : sibling.nextElementSibling;
    }
    if (sibling && sibling.classList.contains("wheelpicker-container-list")) {
      activeContainerRef.current = sibling;
      (_a = sibling.focus) == null ? void 0 : _a.call(sibling);
    }
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
      showHeader: false,
      ...actionsheet,
      show: isOpen,
      showSearchBar: false,
      content: renderDropdownContent(),
      type: "bottom",
      onClose: actionsheet == null ? void 0 : actionsheet.onClose,
      buttonPrimary: {
        label: "Done",
        onClick: () => {
          var _a;
          (_a = actionsheet == null ? void 0 : actionsheet.onClose) == null ? void 0 : _a.call(actionsheet);
        }
      }
    }
  ) });
};
exports.WheelpickerContainerAtom = WheelpickerContainerAtom;
exports.default = WheelpickerContainerAtom;
exports.scrollListContainerToItem = scrollListContainerToItem;
//# sourceMappingURL=index162.cjs.map
