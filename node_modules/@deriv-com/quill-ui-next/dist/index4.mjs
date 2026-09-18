import { jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import TabAtom from "./index65.mjs";
const Tab = ({
  width = "fill-container",
  className = "",
  tabs = [],
  selected: externalSelected = null,
  size = "sm",
  type = "horizontal",
  onChange
}) => {
  const [selected, setSelected] = useState(externalSelected);
  useEffect(() => {
    setSelected(externalSelected);
  }, [externalSelected]);
  const displayTabs = width === "fill-container" && type === "horizontal" ? tabs.slice(0, 3) : tabs;
  return /* @__PURE__ */ jsx(
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
      children: displayTabs.map((tab) => /* @__PURE__ */ jsx(
        TabAtom,
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
export {
  Tab,
  Tab as default
};
//# sourceMappingURL=index4.mjs.map
