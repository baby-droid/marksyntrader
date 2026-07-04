import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import styles from "./index135.mjs";
import { useFocusHandling } from "./index44.mjs";
import { BadgeNotification } from "./index37.mjs";
const MenuSideBarAtom = ({
  className = "",
  icon,
  iconSelected,
  isSelected: externalIsSelected = false,
  label = "",
  badgeLabel = "",
  direction = "column",
  expanded = true,
  onClick
}) => {
  const [showBadge, setShowBadge] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [isSelected, setIsSelected] = useState(externalIsSelected);
  const { handleFocus, handleBlur } = useFocusHandling({
    isDisabled: false,
    setHighlight: setIsFocused,
    onEnter: () => {
      handleClick();
    }
  });
  const handleClick = () => {
    setIsSelected(true);
    setShowBadge(false);
    onClick == null ? void 0 : onClick();
  };
  useEffect(() => {
    if (badgeLabel && badgeLabel !== "") {
      setShowBadge(true);
    }
  }, [badgeLabel]);
  useEffect(() => {
    setIsSelected(externalIsSelected);
  }, [externalIsSelected]);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [
        styles.root,
        className,
        "quill-ui-next-atom quill-ui-next-pointer",
        "quill-ui-next-no-select"
      ].join(" "),
      "data-is-selected": isSelected ? "yes" : "no",
      "data-direction": direction,
      tabIndex: 0,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onClick: handleClick,
      children: [
        /* @__PURE__ */ jsxs("div", { className: styles.iconContainer, children: [
          direction === "column" && /* @__PURE__ */ jsxs(Fragment, { children: [
            isFocused && /* @__PURE__ */ jsx("div", { className: styles.bgFocus }),
            showBadge && badgeLabel !== "" && /* @__PURE__ */ jsx("div", { className: styles.badgeNotification, children: /* @__PURE__ */ jsx(BadgeNotification, { size: "sm", label: badgeLabel }) })
          ] }),
          isSelected ? iconSelected || icon : icon
        ] }),
        label && /* @__PURE__ */ jsx("div", { className: styles.label, children: label }),
        direction === "row" && /* @__PURE__ */ jsxs(Fragment, { children: [
          isFocused && /* @__PURE__ */ jsx("div", { className: styles.bgFocus }),
          showBadge && badgeLabel !== "" && /* @__PURE__ */ jsx(
            "div",
            {
              className: `${styles.badgeContainer} ${!expanded && styles.badgeContainerCompress}`,
              children: /* @__PURE__ */ jsx(BadgeNotification, { size: "sm", label: badgeLabel })
            }
          )
        ] })
      ]
    }
  );
};
export {
  MenuSideBarAtom as default
};
//# sourceMappingURL=index104.mjs.map
