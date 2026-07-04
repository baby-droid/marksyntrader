import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import styles from "./index89.mjs";
import { LabelPairedChevronDownMdRegularIcon } from "@deriv/quill-icons";
import { useFocusHandling } from "./index44.mjs";
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
  const [isExpanded, setIsExpanded] = useState(expand === "on");
  const [focus, setFocus] = useState(showFocusRing);
  const accordionId = `quill-accordion-${size}-${type}-${state}`;
  const isClickable = state !== "disabled";
  const handleToggle = () => {
    if (isClickable) {
      setIsExpanded(!isExpanded);
    }
  };
  const { handleFocus, handleBlur } = useFocusHandling({
    isDisabled: !isClickable,
    setHighlight: setFocus,
    onEnter: () => handleToggle()
  });
  useEffect(() => {
    setIsExpanded(expand === "on");
  }, [expand]);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [styles.root, className].join(" "),
      "data-expand": isExpanded ? "on" : "off",
      "data-size": size,
      "data-state": state,
      "data-type": type,
      "data-id": accordionId,
      children: [
        /* @__PURE__ */ jsxs(
          "div",
          {
            className: [
              styles.header,
              isClickable ? "quill-ui-next-pointer" : "",
              "quill-ui-next-component"
            ].join(" "),
            onClick: handleToggle,
            role: isClickable ? "button" : void 0,
            tabIndex: isClickable ? 0 : void 0,
            onFocus: handleFocus,
            onBlur: handleBlur,
            children: [
              focus && /* @__PURE__ */ jsx("div", { className: styles.bgFocus }),
              customIcon && /* @__PURE__ */ jsx("div", { className: styles.placeholderIcon, children: /* @__PURE__ */ jsx("div", { className: `${styles.icon1} accordion-icon`, children: customIcon }) }),
              /* @__PURE__ */ jsxs("div", { className: styles.titleSubtitle, children: [
                /* @__PURE__ */ jsx("b", { className: styles.title, children: title }),
                subtitle && /* @__PURE__ */ jsx("div", { className: styles.subtitle, children: subtitle })
              ] }),
              /* @__PURE__ */ jsx("div", { className: styles.iconChevron, children: /* @__PURE__ */ jsx("div", { className: `${styles.icon2} accordion-icon`, children: /* @__PURE__ */ jsx(
                LabelPairedChevronDownMdRegularIcon,
                {
                  className: `quill-ui-next-rotatable ${isExpanded && "quill-ui-next-rotate"}`
                }
              ) }) })
            ]
          }
        ),
        children && /* @__PURE__ */ jsx("div", { className: styles.body, children: /* @__PURE__ */ jsx(
          "div",
          {
            className: `${styles.bodyContent} quill-ui-next-accordion-content`,
            children
          }
        ) })
      ]
    }
  );
};
export {
  Accordion,
  Accordion as default
};
//# sourceMappingURL=index13.mjs.map
