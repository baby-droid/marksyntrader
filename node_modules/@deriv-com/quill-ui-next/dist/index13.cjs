"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const AccordionDefault_module = require("./index89.cjs");
const quillIcons = require("@deriv/quill-icons");
const useFocusHandling = require("./index44.cjs");
const Accordion = ({
  className = "",
  expand = "off",
  size = "xs",
  state = "default",
  type = "outline",
  title = "Title",
  subtitle,
  customIcon,
  showFocusRing = false,
  children
}) => {
  const [isExpanded, setIsExpanded] = React.useState(expand === "on");
  const [focus, setFocus] = React.useState(showFocusRing);
  const accordionId = `quill-accordion-${size}-${type}-${state}`;
  const isClickable = state !== "disabled";
  const handleToggle = () => {
    if (isClickable) {
      setIsExpanded(!isExpanded);
    }
  };
  const { handleFocus, handleBlur } = useFocusHandling.useFocusHandling({
    isDisabled: !isClickable,
    setHighlight: setFocus,
    onEnter: () => handleToggle()
  });
  React.useEffect(() => {
    setIsExpanded(expand === "on");
  }, [expand]);
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [AccordionDefault_module.default.root, className].join(" "),
      "data-expand": isExpanded ? "on" : "off",
      "data-size": size,
      "data-state": state,
      "data-type": type,
      "data-id": accordionId,
      children: [
        /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            className: [
              AccordionDefault_module.default.header,
              isClickable ? "quill-ui-next-pointer" : "",
              "quill-ui-next-component"
            ].join(" "),
            onClick: handleToggle,
            role: isClickable ? "button" : void 0,
            tabIndex: isClickable ? 0 : void 0,
            onFocus: handleFocus,
            onBlur: handleBlur,
            children: [
              focus && /* @__PURE__ */ jsxRuntime.jsx("div", { className: AccordionDefault_module.default.bgFocus }),
              customIcon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: AccordionDefault_module.default.placeholderIcon, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${AccordionDefault_module.default.icon1} accordion-icon`, children: customIcon }) }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: AccordionDefault_module.default.titleSubtitle, children: [
                /* @__PURE__ */ jsxRuntime.jsx("b", { className: AccordionDefault_module.default.title, children: title }),
                subtitle && /* @__PURE__ */ jsxRuntime.jsx("div", { className: AccordionDefault_module.default.subtitle, children: subtitle })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: AccordionDefault_module.default.iconChevron, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${AccordionDefault_module.default.icon2} accordion-icon`, children: /* @__PURE__ */ jsxRuntime.jsx(
                quillIcons.LabelPairedChevronDownMdRegularIcon,
                {
                  className: `quill-ui-next-rotatable ${isExpanded && "quill-ui-next-rotate"}`
                }
              ) }) })
            ]
          }
        ),
        children && /* @__PURE__ */ jsxRuntime.jsx("div", { className: AccordionDefault_module.default.body, children: /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: `${AccordionDefault_module.default.bodyContent} quill-ui-next-accordion-content`,
            children
          }
        ) })
      ]
    }
  );
};
exports.Accordion = Accordion;
exports.default = Accordion;
//# sourceMappingURL=index13.cjs.map
