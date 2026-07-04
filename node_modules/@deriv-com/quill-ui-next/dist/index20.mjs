import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import styles from "./index103.mjs";
import MenuSideBarAtom from "./index104.mjs";
import { IconButton } from "./index35.mjs";
import { LabelPairedChevronLeftSmBoldIcon, LabelPairedChevronRightSmBoldIcon } from "@deriv/quill-icons";
const NavigationSideBar = ({
  className = "",
  onChange,
  items = [],
  stickyItems = [],
  type = "expandable",
  selected: externalSelected,
  expanded: externalExpanded = true
}) => {
  const [selected, setSelected] = useState(externalSelected);
  const [expanded, setExpanded] = useState(externalExpanded);
  const [compress, setCompress] = useState(false);
  const handleExpand = () => {
    const timer = !expanded ? 0 : 500;
    setExpanded((prev) => !prev);
    setTimeout(() => {
      setCompress((prev) => !prev);
    }, timer);
  };
  const handleClick = (item) => {
    setSelected(item);
    onChange == null ? void 0 : onChange(item);
  };
  useEffect(() => {
    setSelected(externalSelected);
  }, [externalSelected]);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [
        styles.root,
        "quill-ui-next-component",
        "quill-ui-next-no-select",
        className
      ].join(" "),
      "data-type": type,
      "data-is-expanded": expanded ? "yes" : "no",
      children: [
        /* @__PURE__ */ jsx("div", { className: styles.menuContainer, children: items.map((group, groupIdx) => /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { className: styles.menuGroupContainer, children: group.map((item, idx) => /* @__PURE__ */ jsx(
            MenuSideBarAtom,
            {
              label: compress && type === "expandable" ? "" : item == null ? void 0 : item.label,
              icon: item == null ? void 0 : item.icon,
              iconSelected: item == null ? void 0 : item.iconSelected,
              onClick: () => handleClick(item),
              isSelected: selected === item,
              badgeLabel: item == null ? void 0 : item.badgeLabel,
              direction: type === "expandable" ? "row" : "column",
              expanded: type === "expandable" && !compress
            },
            `${item.label ?? ""}-${idx}`
          )) }),
          groupIdx !== items.length - 1 && /* @__PURE__ */ jsx("div", { className: styles.divider })
        ] })) }),
        type === "fixed" && stickyItems.length > 0 && /* @__PURE__ */ jsxs(
          "div",
          {
            className: [styles.stickyContainer, styles.menuGroupContainer].join(" "),
            children: [
              /* @__PURE__ */ jsx("div", { className: styles.divider }),
              stickyItems.map((item, idx) => /* @__PURE__ */ jsx(MenuSideBarAtom, { ...item }, `${item.label ?? ""}-${idx}`))
            ]
          }
        ),
        type === "expandable" && /* @__PURE__ */ jsx(
          "div",
          {
            className: `${styles.bottomContainer} ${!compress && styles.bottomContainerExpanded}`,
            children: /* @__PURE__ */ jsx(
              IconButton,
              {
                icon: expanded ? /* @__PURE__ */ jsx(LabelPairedChevronLeftSmBoldIcon, {}) : /* @__PURE__ */ jsx(LabelPairedChevronRightSmBoldIcon, {}),
                color: "blackWhite",
                style: "tertiary",
                onClick: handleExpand
              }
            )
          }
        )
      ]
    }
  );
};
NavigationSideBar.displayName = "NavigationSideBar";
export {
  NavigationSideBar,
  NavigationSideBar as default
};
//# sourceMappingURL=index20.mjs.map
