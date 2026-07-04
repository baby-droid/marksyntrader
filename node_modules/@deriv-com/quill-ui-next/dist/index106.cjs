"use strict";
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const MenuBottomBarAtom_module = require("./index130.cjs");
const useFocusHandling = require("./index44.cjs");
;/* empty css         */
require("./index3.cjs");
require("./index4.cjs");
require("./index5.cjs");
require("@deriv/quill-icons");
require("react-dom");
require("./index7.cjs");
require("./index8.cjs");
require("./index9.cjs");
require("./index10.cjs");
require("./index12.cjs");
require("./index20.cjs");
require("./index21.cjs");
require("./index36.cjs");
require("./index23.cjs");
require("./index94.cjs");
require("./index25.cjs");
require("./index26.cjs");
require("framer-motion");
require("./index95.cjs");
;/* empty css          */
;/* empty css          */
require("react-calendar");
require("date-fns");
require("./index98.cjs");
require("./index35.cjs");
require("./index99.cjs");
require("./index31.cjs");
const index = require("./index37.cjs");
require("./index38.cjs");
require("./index39.cjs");
require("./index40.cjs");
require("./index41.cjs");
require("./index42.cjs");
require("./index43.cjs");
const MenuBottomBarBase = ({
  className = "",
  state: externalState = "default",
  icon,
  iconSelected,
  label = "",
  badgeLabel = "",
  onClick
}) => {
  const [highlight, setHighlight] = React.useState(false);
  const [state, setState] = React.useState(externalState);
  const [showBadge, setShowBadge] = React.useState(true);
  const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
    isDisabled: false,
    setHighlight,
    onEnter: () => {
      handleClick();
    }
  });
  const handleClick = () => {
    setShowBadge(false);
    setState("selected");
    onClick == null ? void 0 : onClick();
  };
  React.useEffect(() => {
    setState(externalState);
  }, [externalState]);
  React.useEffect(() => {
    if (badgeLabel && badgeLabel !== "") {
      setShowBadge(true);
    }
  }, [badgeLabel]);
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [
        MenuBottomBarAtom_module.default.root,
        className,
        "quill-ui-next-atom quill-ui-next-pointer"
      ].join(" "),
      "data-state": state,
      "data-label": label !== "" ? "yes" : "no",
      tabIndex: 0,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onClick: handleClick,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: MenuBottomBarAtom_module.default.icon1, children: state === "selected" ? iconSelected || icon : icon }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: MenuBottomBarAtom_module.default.label, children: label }),
        showBadge && badgeLabel !== "" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: MenuBottomBarAtom_module.default.badgeNotification, children: /* @__PURE__ */ jsxRuntime.jsx(index.BadgeNotification, { size: "sm", label: badgeLabel }) }),
        highlight && /* @__PURE__ */ jsxRuntime.jsx("div", { className: MenuBottomBarAtom_module.default.bgFocus })
      ]
    }
  );
};
module.exports = MenuBottomBarBase;
//# sourceMappingURL=index106.cjs.map
