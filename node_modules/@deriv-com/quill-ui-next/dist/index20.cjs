"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const NavigationSideBar_module = require("./index103.cjs");
const index = require("./index104.cjs");
const index$1 = require("./index35.cjs");
const quillIcons = require("@deriv/quill-icons");
const NavigationSideBar = ({
  className = "",
  onChange,
  items = [],
  stickyItems = [],
  type = "expandable",
  selected: externalSelected,
  expanded: externalExpanded = true
}) => {
  const [selected, setSelected] = React.useState(externalSelected);
  const [expanded, setExpanded] = React.useState(externalExpanded);
  const [compress, setCompress] = React.useState(false);
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
  React.useEffect(() => {
    setSelected(externalSelected);
  }, [externalSelected]);
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [
        NavigationSideBar_module.default.root,
        "quill-ui-next-component",
        "quill-ui-next-no-select",
        className
      ].join(" "),
      "data-type": type,
      "data-is-expanded": expanded ? "yes" : "no",
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: NavigationSideBar_module.default.menuContainer, children: items.map((group, groupIdx) => /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: NavigationSideBar_module.default.menuGroupContainer, children: group.map((item, idx) => /* @__PURE__ */ jsxRuntime.jsx(
            index,
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
          groupIdx !== items.length - 1 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: NavigationSideBar_module.default.divider })
        ] })) }),
        type === "fixed" && stickyItems.length > 0 && /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            className: [NavigationSideBar_module.default.stickyContainer, NavigationSideBar_module.default.menuGroupContainer].join(" "),
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: NavigationSideBar_module.default.divider }),
              stickyItems.map((item, idx) => /* @__PURE__ */ jsxRuntime.jsx(index, { ...item }, `${item.label ?? ""}-${idx}`))
            ]
          }
        ),
        type === "expandable" && /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: `${NavigationSideBar_module.default.bottomContainer} ${!compress && NavigationSideBar_module.default.bottomContainerExpanded}`,
            children: /* @__PURE__ */ jsxRuntime.jsx(
              index$1.IconButton,
              {
                icon: expanded ? /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronLeftSmBoldIcon, {}) : /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronRightSmBoldIcon, {}),
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
exports.NavigationSideBar = NavigationSideBar;
exports.default = NavigationSideBar;
//# sourceMappingURL=index20.cjs.map
