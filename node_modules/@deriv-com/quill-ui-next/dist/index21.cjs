"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const NavigationBottomBar_module = require("./index105.cjs");
const index = require("./index106.cjs");
const NavigationBottomBar = ({ className = "", onChange, items = [] }) => {
  const [selected, setSelected] = React.useState(items[0]);
  const handleClick = (item) => {
    setSelected(item);
    onChange == null ? void 0 : onChange(item);
  };
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      className: [
        NavigationBottomBar_module.default.typeiconOnly,
        "quill-ui-next-component",
        "quill-ui-next-no-select",
        className
      ].join(" "),
      children: items.map((item) => /* @__PURE__ */ jsxRuntime.jsx(
        index,
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
exports.NavigationBottomBar = NavigationBottomBar;
exports.default = NavigationBottomBar;
//# sourceMappingURL=index21.cjs.map
