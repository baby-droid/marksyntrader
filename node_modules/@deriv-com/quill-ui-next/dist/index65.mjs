import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import iconTopStyles from "./index119.mjs";
import iconLeftStyles from "./index120.mjs";
import { useFocusHandling } from "./index44.mjs";
import { Tag } from "./index3.mjs";
/* empty css        */
import "./index4.mjs";
import "./index5.mjs";
import "@deriv/quill-icons";
import "react-dom";
import "./index7.mjs";
import "./index8.mjs";
import "./index9.mjs";
import "./index10.mjs";
import "./index12.mjs";
import "./index20.mjs";
import "./index21.mjs";
import "./index36.mjs";
import "./index23.mjs";
import "./index94.mjs";
import "./index25.mjs";
import "./index26.mjs";
import "framer-motion";
import "./index95.mjs";
/* empty css         */
/* empty css         */
import "react-calendar";
import "date-fns";
import "./index98.mjs";
import "./index35.mjs";
import "./index99.mjs";
import "./index31.mjs";
import { BadgeNotification } from "./index37.mjs";
import "./index38.mjs";
import "./index39.mjs";
import "./index40.mjs";
import "./index41.mjs";
import "./index42.mjs";
import "./index43.mjs";
const TabAtomStyles = {
  "icon-top": iconTopStyles,
  "icon-left": iconLeftStyles
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
  const [highLight, setHighLight] = useState(false);
  const [state, setState] = useState(externalState);
  const [selected, setSelected] = useState(externalSelected);
  const styles = TabAtomStyles[style];
  const TabAtomId = `quill-ui-next-tab-atom-${size}-${style}-${state}-selected-${selected}`;
  const { handleBlur, handleFocus } = useFocusHandling({
    isDisabled: state === "disabled",
    setHighlight: setHighLight
  });
  const renderItems = () => /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: styles.label, children: label }),
    labelIcon && /* @__PURE__ */ jsx("div", { className: `${styles.iconSm} quill-tab-icon`, children: labelIcon }),
    tag && /* @__PURE__ */ jsx(Tag, { ...tag }),
    badge && /* @__PURE__ */ jsx(BadgeNotification, { ...badge })
  ] });
  const handleClick = () => {
    onClick == null ? void 0 : onClick();
  };
  useEffect(() => {
    setSelected(externalSelected);
  }, [externalSelected]);
  useEffect(() => {
    setState(selected ? "selected" : "default");
  }, [selected]);
  useEffect(() => {
    setState(externalState);
  }, [externalState]);
  return /* @__PURE__ */ jsxs(
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
        icon && /* @__PURE__ */ jsx("div", { className: `${styles.customIcon} quill-tab-icon`, children: icon }),
        style === "icon-top" ? /* @__PURE__ */ jsx("div", { className: styles.labelStatus, children: renderItems() }) : renderItems(),
        highLight && /* @__PURE__ */ jsx("div", { className: styles.bgFocus })
      ]
    }
  );
};
export {
  TabAtom as default
};
//# sourceMappingURL=index65.mjs.map
