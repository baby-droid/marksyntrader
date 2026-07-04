import { jsx } from "react/jsx-runtime";
import { useState } from "react";
import styles from "./index105.mjs";
import MenuBottomBarBase from "./index106.mjs";
const NavigationBottomBar = ({ className = "", onChange, items = [] }) => {
  const [selected, setSelected] = useState(items[0]);
  const handleClick = (item) => {
    setSelected(item);
    onChange == null ? void 0 : onChange(item);
  };
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: [
        styles.typeiconOnly,
        "quill-ui-next-component",
        "quill-ui-next-no-select",
        className
      ].join(" "),
      children: items.map((item) => /* @__PURE__ */ jsx(
        MenuBottomBarBase,
        {
          label: item == null ? void 0 : item.label,
          icon: item == null ? void 0 : item.icon,
          iconSelected: item == null ? void 0 : item.iconSelected,
          onClick: () => handleClick(item),
          state: selected === item ? "selected" : "default",
          badgeLabel: item == null ? void 0 : item.badgeLabel
        }
      ))
    }
  );
};
NavigationBottomBar.displayName = "NavigationBottomBar";
export {
  NavigationBottomBar,
  NavigationBottomBar as default
};
//# sourceMappingURL=index21.mjs.map
