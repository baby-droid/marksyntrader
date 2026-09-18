import { jsxs, jsx } from "react/jsx-runtime";
import { useState } from "react";
import desktopStyles from "./index85.mjs";
import mobileStyles from "./index86.mjs";
import { LabelPairedChevronRightSmRegularIcon } from "@deriv/quill-icons";
import { useFocusHandling } from "./index44.mjs";
const Breadcrumb = ({
  className = "",
  variant = "desktop",
  size = "sm",
  state = "default",
  label = "Label",
  showFocusRing = false,
  onClick
}) => {
  const styles = variant === "desktop" ? desktopStyles : mobileStyles;
  const [focus, setFocus] = useState(showFocusRing);
  const containerClassName = variant === "desktop" ? styles.containerText : styles.containerLabel;
  const isClickable = state !== "selected" && onClick;
  const breadcrumbId = `quill-breadcrumb-${variant}-${size}-${state}`;
  const { handleFocus, handleBlur } = useFocusHandling({
    isDisabled: !isClickable,
    setHighlight: setFocus
  });
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [styles.root, className].join(" "),
      "data-size": size,
      "data-state": state,
      "data-id": breadcrumbId,
      children: [
        /* @__PURE__ */ jsxs("div", { className: containerClassName, children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: [
                styles.label,
                isClickable ? "quill-ui-next-pointer" : ""
              ].join(" "),
              onClick: isClickable ? onClick : void 0,
              role: isClickable ? "button" : void 0,
              tabIndex: isClickable ? 0 : void 0,
              onFocus: handleFocus,
              onBlur: handleBlur,
              children: label
            }
          ),
          focus && /* @__PURE__ */ jsx("div", { className: styles.bgFocus })
        ] }),
        /* @__PURE__ */ jsx("div", { className: `${styles.iconDivider} breadcrumb-icon`, children: /* @__PURE__ */ jsx(LabelPairedChevronRightSmRegularIcon, {}) })
      ]
    }
  );
};
export {
  Breadcrumb,
  Breadcrumb as default
};
//# sourceMappingURL=index11.mjs.map
