"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index71.cjs");
const SegmentedControl_module = require("./index72.cjs");
const SegmentedControl = ({
  className = "",
  size = "sm",
  type = "single",
  items = [],
  selected: externalSelected = [],
  onChange
}) => {
  const [selected, setSelected] = React.useState(externalSelected);
  const handleClick = (value) => {
    let newSelected = [...selected];
    if (type === "single") {
      newSelected = [];
    }
    newSelected.includes(value) ? newSelected = newSelected.filter((item) => item !== value) : newSelected.push(value);
    setSelected(newSelected);
    onChange == null ? void 0 : onChange(newSelected);
  };
  React.useEffect(() => {
    if (type === "single" && selected.length === 0 && items.length > 0) {
      setSelected([items[0].value || ""]);
    }
  }, []);
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      className: [
        SegmentedControl_module.default.root,
        className,
        "quill-ui-next-component",
        "quill-ui-next-segmented-control"
      ].join(" "),
      "data-size": size,
      "data-type": type,
      "data-selected": selected,
      children: items.map((item) => /* @__PURE__ */ jsxRuntime.jsx(
        index,
        {
          ...item,
          size,
          type,
          isSelected: selected.includes(item.value || ""),
          onClick: handleClick
        },
        item.value
      ))
    }
  );
};
SegmentedControl.displayName = "SegmentedControl";
exports.SegmentedControl = SegmentedControl;
exports.default = SegmentedControl;
//# sourceMappingURL=index7.cjs.map
