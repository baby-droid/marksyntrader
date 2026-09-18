"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index118.cjs");
const TimeWheelpicker = ({ format = "12", selected, ...props }) => {
  var _a;
  const timeData = React.useMemo(() => {
    const hours = format === "24" ? Array.from({ length: 24 }, (_, i) => ({
      label: String(i).padStart(2, "0"),
      value: String(i).padStart(2, "0")
    })) : Array.from({ length: 12 }, (_, i) => ({
      label: String(i + 1).padStart(2, "0"),
      value: String(i + 1).padStart(2, "0")
    }));
    const minutes = Array.from({ length: 60 }, (_, i) => ({
      label: String(i).padStart(2, "0"),
      value: String(i).padStart(2, "0")
    }));
    const ampm = format === "12" ? [
      { label: "AM", value: "AM" },
      { label: "PM", value: "PM" }
    ] : void 0;
    return ampm ? [{ items: hours }, { items: minutes, extra: ":" }, { items: ampm }] : [{ items: hours }, { items: minutes, extra: ":" }];
  }, [format]);
  const defaultSelected = React.useMemo(() => {
    var _a2;
    const hours = timeData[0].items;
    const minutes = timeData[1].items;
    const ampm = (_a2 = timeData[2]) == null ? void 0 : _a2.items;
    return ampm ? [hours[0], minutes[0], ampm[0]] : [hours[0], minutes[0]];
  }, [timeData]);
  const [value, setValue] = React.useState(defaultSelected);
  return /* @__PURE__ */ jsxRuntime.jsx(
    index,
    {
      textAlignment: "center",
      ...props,
      data: timeData,
      selected: selected || defaultSelected,
      customValue: `${value[0].label}:${value[1].label} ${(_a = value[2]) == null ? void 0 : _a.label}`,
      onChange: (e) => setValue(e),
      itemWidth: "fit-content"
    }
  );
};
TimeWheelpicker.displayName = "TimeWheelpicker";
exports.TimeWheelpicker = TimeWheelpicker;
exports.default = TimeWheelpicker;
//# sourceMappingURL=index40.cjs.map
