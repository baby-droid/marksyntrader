import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useRef, useState } from "react";
import buttonStyles from "./index121.mjs";
import pageStyles from "./index122.mjs";
import bulletStyles from "./index123.mjs";
import { StandalonePlaceholderRegularIcon } from "@deriv/quill-icons";
import { useFocusHandling } from "./index44.mjs";
const paginationAtomStyles = {
  button: buttonStyles,
  page: pageStyles,
  bullet: bulletStyles
};
const PaginationAtom = ({
  className = "",
  state = "default",
  variant = "button",
  icon,
  label = "0",
  onClick
}) => {
  const styles = paginationAtomStyles[variant];
  const paginationAtomId = `pagination-atom-${variant}-${state}`;
  const IconComponent = icon || /* @__PURE__ */ jsx(StandalonePlaceholderRegularIcon, { iconSize: "md" });
  const buttonRef = useRef(null);
  const [highlight, setHighlight] = useState(false);
  const handleClick = () => {
    if (state === "disabled") return;
    onClick == null ? void 0 : onClick();
  };
  const { handleFocus, handleBlur } = useFocusHandling({
    isDisabled: state === "disabled",
    setHighlight,
    onEnter: () => {
      handleClick();
    }
  });
  return /* @__PURE__ */ jsxs(
    "div",
    {
      ref: buttonRef,
      className: [
        styles.root,
        "quill-ui-next-atom",
        "quill-ui-next-no-select",
        state !== "disabled" && "quill-ui-next-pointer",
        className
      ].join(" "),
      "data-id": paginationAtomId,
      "data-state": state,
      tabIndex: state !== "disabled" ? 0 : -1,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onClick: handleClick,
      children: [
        variant === "button" && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { className: styles.customIcon, children: IconComponent }),
          /* @__PURE__ */ jsx("div", { className: styles.hiddenLabel })
        ] }),
        variant === "page" && /* @__PURE__ */ jsx("div", { className: styles.label, children: label }),
        highlight && /* @__PURE__ */ jsx("div", { className: styles.focus })
      ]
    }
  );
};
PaginationAtom.displayName = "PaginationAtom";
export {
  PaginationAtom as default
};
//# sourceMappingURL=index74.mjs.map
