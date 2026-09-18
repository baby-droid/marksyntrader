"use strict";
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const TabIconTopAtom_module = require("./index119.cjs");
const TabIconLeftAtom_module = require("./index120.cjs");
const useFocusHandling = require("./index44.cjs");
const index = require("./index3.cjs");
;/* empty css         */
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
const index$1 = require("./index37.cjs");
require("./index38.cjs");
require("./index39.cjs");
require("./index40.cjs");
require("./index41.cjs");
require("./index42.cjs");
require("./index43.cjs");
const TabAtomStyles = {
  "icon-top": TabIconTopAtom_module.default,
  "icon-left": TabIconLeftAtom_module.default
};
const TabAtom = ({
  className = "",
  size = "sm",
  state: externalState = "default",
  style = "icon-top",
  label = "Label",
  icon,
  labelIcon,
  tag,
  badge,
  selected: externalSelected,
  type = "horizontal",
  onClick
}) => {
  const [highLight, setHighLight] = React.useState(false);
  const [state, setState] = React.useState(externalState);
  const [selected, setSelected] = React.useState(externalSelected);
  const styles = TabAtomStyles[style];
  const TabAtomId = `quill-ui-next-tab-atom-${size}-${style}-${state}-selected-${selected}`;
  const { handleBlur, handleFocus } = useFocusHandling.useFocusHandling({
    isDisabled: state === "disabled",
    setHighlight: setHighLight
  });
  const renderItems = () => /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.label, children: label }),
    labelIcon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${styles.iconSm} quill-tab-icon`, children: labelIcon }),
    tag && /* @__PURE__ */ jsxRuntime.jsx(index.Tag, { ...tag }),
    badge && /* @__PURE__ */ jsxRuntime.jsx(index$1.BadgeNotification, { ...badge })
  ] });
  const handleClick = () => {
    onClick == null ? void 0 : onClick();
  };
  React.useEffect(() => {
    setSelected(externalSelected);
  }, [externalSelected]);
  React.useEffect(() => {
    setState(selected ? "selected" : "default");
  }, [selected]);
  React.useEffect(() => {
    setState(externalState);
  }, [externalState]);
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [
        styles.root,
        className,
        "quill-ui-next-atom",
        "quill-ui-next-no-select",
        state !== "disabled" && "quill-ui-next-pointer"
      ].join(" "),
      "data-size": size,
      "data-state": state,
      "data-type": type,
      "data-id": TabAtomId,
      tabIndex: 0,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onClick: handleClick,
      children: [
        icon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${styles.customIcon} quill-tab-icon`, children: icon }),
        style === "icon-top" ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.labelStatus, children: renderItems() }) : renderItems(),
        highLight && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.bgFocus })
      ]
    }
  );
};
module.exports = TabAtom;
//# sourceMappingURL=index65.cjs.map
