import { jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import SegmentedControlAtom from "./index71.mjs";
import styles from "./index72.mjs";
const SegmentedControl = ({
  className = "",
  size = "sm",
  type = "single",
  items = [],
  selected: externalSelected = [],
  onChange
}) => {
  const [selected, setSelected] = useState(externalSelected);
  const handleClick = (value) => {
    let newSelected = [...selected];
    if (type === "single") {
      newSelected = [];
    }
    newSelected.includes(value) ? newSelected = newSelected.filter((item) => item !== value) : newSelected.push(value);
    setSelected(newSelected);
    onChange == null ? void 0 : onChange(newSelected);
  };
  useEffect(() => {
    if (type === "single" && selected.length === 0 && items.length > 0) {
      setSelected([items[0].value || ""]);
    }
  }, []);
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: [
        styles.root,
        className,
        "quill-ui-next-component",
        "quill-ui-next-segmented-control"
      ].join(" "),
      "data-size": size,
      "data-type": type,
      "data-selected": selected,
      children: items.map((item) => /* @__PURE__ */ jsx(
        SegmentedControlAtom,
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
export {
  SegmentedControl,
  SegmentedControl as default
};
//# sourceMappingURL=index7.mjs.map
