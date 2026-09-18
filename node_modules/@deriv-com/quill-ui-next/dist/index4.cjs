"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index65.cjs");
const Tab = ({
  width = "fill-container",
  className = "",
  tabs = [],
  selected: externalSelected = null,
  size = "sm",
  type = "horizontal",
  onChange
}) => {
  const [selected, setSelected] = React.useState(externalSelected);
  React.useEffect(() => {
    setSelected(externalSelected);
  }, [externalSelected]);
  const displayTabs = width === "fill-container" && type === "horizontal" ? tabs.slice(0, 3) : tabs;
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      className: [
        `quill-ui-next-component ${type === "horizontal" ? "quill-ui-next-full-width" : ""}`,
        "quill-next-ui-tab-container",
        `size-${size}`,
        width,
        type,
        className
      ].join(" "),
      children: displayTabs.map((tab) => /* @__PURE__ */ jsxRuntime.jsx(
        index,
        {
          ...tab,
          size,
          selected: (selected == null ? void 0 : selected.label) === tab.label,
          type,
          onClick: () => {
            var _a;
            setSelected(tab);
            onChange == null ? void 0 : onChange(tab);
            (_a = tab.onClick) == null ? void 0 : _a.call(tab);
          }
        },
        `quill-ui-next-tab-${tab.label}`
      ))
    }
  );
};
Tab.displayName = "Tab";
exports.Tab = Tab;
exports.default = Tab;
//# sourceMappingURL=index4.cjs.map
