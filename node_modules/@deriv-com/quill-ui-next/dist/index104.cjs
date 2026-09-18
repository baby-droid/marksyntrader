"use strict";
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const MenuSideBar_module = require("./index135.cjs");
const useFocusHandling = require("./index44.cjs");
const index = require("./index37.cjs");
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
  const [showBadge, setShowBadge] = React.useState(true);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isSelected, setIsSelected] = React.useState(externalIsSelected);
  const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
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
  React.useEffect(() => {
    if (badgeLabel && badgeLabel !== "") {
      setShowBadge(true);
    }
  }, [badgeLabel]);
  React.useEffect(() => {
    setIsSelected(externalIsSelected);
  }, [externalIsSelected]);
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [
        MenuSideBar_module.default.root,
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
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: MenuSideBar_module.default.iconContainer, children: [
          direction === "column" && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
            isFocused && /* @__PURE__ */ jsxRuntime.jsx("div", { className: MenuSideBar_module.default.bgFocus }),
            showBadge && badgeLabel !== "" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: MenuSideBar_module.default.badgeNotification, children: /* @__PURE__ */ jsxRuntime.jsx(index.BadgeNotification, { size: "sm", label: badgeLabel }) })
          ] }),
          isSelected ? iconSelected || icon : icon
        ] }),
        label && /* @__PURE__ */ jsxRuntime.jsx("div", { className: MenuSideBar_module.default.label, children: label }),
        direction === "row" && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          isFocused && /* @__PURE__ */ jsxRuntime.jsx("div", { className: MenuSideBar_module.default.bgFocus }),
          showBadge && badgeLabel !== "" && /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: `${MenuSideBar_module.default.badgeContainer} ${!expanded && MenuSideBar_module.default.badgeContainerCompress}`,
              children: /* @__PURE__ */ jsxRuntime.jsx(index.BadgeNotification, { size: "sm", label: badgeLabel })
            }
          )
        ] })
      ]
    }
  );
};
module.exports = MenuSideBarAtom;
//# sourceMappingURL=index104.cjs.map
