import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import styles from "./index130.mjs";
import { useFocusHandling } from "./index44.mjs";
/* empty css        */
import "./index3.mjs";
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
const MenuBottomBarBase = ({
  className = "",
  state: externalState = "default",
  icon,
  iconSelected,
  label = "",
  badgeLabel = "",
  onClick
}) => {
  const [highlight, setHighlight] = useState(false);
  const [state, setState] = useState(externalState);
  const [showBadge, setShowBadge] = useState(true);
  const { handleFocus, handleBlur } = useFocusHandling({
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
  useEffect(() => {
    setState(externalState);
  }, [externalState]);
  useEffect(() => {
    if (badgeLabel && badgeLabel !== "") {
      setShowBadge(true);
    }
  }, [badgeLabel]);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [
        styles.root,
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
        /* @__PURE__ */ jsx("div", { className: styles.icon1, children: state === "selected" ? iconSelected || icon : icon }),
        /* @__PURE__ */ jsx("div", { className: styles.label, children: label }),
        showBadge && badgeLabel !== "" && /* @__PURE__ */ jsx("div", { className: styles.badgeNotification, children: /* @__PURE__ */ jsx(BadgeNotification, { size: "sm", label: badgeLabel }) }),
        highlight && /* @__PURE__ */ jsx("div", { className: styles.bgFocus })
      ]
    }
  );
};
export {
  MenuBottomBarBase as default
};
//# sourceMappingURL=index106.mjs.map
