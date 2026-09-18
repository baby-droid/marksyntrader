import { jsx } from "react/jsx-runtime";
import notificationStyles from "./index146.mjs";
const badgeStyles = {
  notification: notificationStyles
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
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: [styles.root, className, "quill-ui-next-component"].join(" "),
      "data-size": size,
      "data-empty-badge": !showLabel,
      children: showLabel && /* @__PURE__ */ jsx("b", { className: styles.label, children: displayLabel() })
    }
  );
};
export {
  Badge as default
};
//# sourceMappingURL=index117.mjs.map
