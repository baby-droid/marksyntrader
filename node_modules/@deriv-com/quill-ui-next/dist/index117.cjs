"use strict";
const jsxRuntime = require("react/jsx-runtime");
const BadgeNotification_module = require("./index146.cjs");
const badgeStyles = {
  notification: BadgeNotification_module.default
};
const Badge = ({
  className = "",
  size = "sm",
  label = "1",
  showLabel = true,
  style = "notification"
}) => {
  const styles = badgeStyles[style];
  const displayLabel = () => {
    const numLabel = Number(label);
    if (!isNaN(numLabel) && numLabel > 99) {
      return "99+";
    }
    return label;
  };
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      className: [styles.root, className, "quill-ui-next-component"].join(" "),
      "data-size": size,
      "data-empty-badge": !showLabel,
      children: showLabel && /* @__PURE__ */ jsxRuntime.jsx("b", { className: styles.label, children: displayLabel() })
    }
  );
};
module.exports = Badge;
//# sourceMappingURL=index117.cjs.map
