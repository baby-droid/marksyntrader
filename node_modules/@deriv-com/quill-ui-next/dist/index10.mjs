import { jsxs, jsx } from "react/jsx-runtime";
import BlackWhiteStyles from "./index76.mjs";
import BlackStyles from "./index77.mjs";
import WhiteBlackStyles from "./index78.mjs";
import WhiteStyles from "./index79.mjs";
import ForwardRef from "./index80.mjs";
import ForwardRef$1 from "./index81.mjs";
import ForwardRef$2 from "./index82.mjs";
import ForwardRef$3 from "./index83.mjs";
import ForwardRef$4 from "./index84.mjs";
const linkStyles = {
  blackWhite: BlackWhiteStyles,
  black: BlackStyles,
  whiteBlack: WhiteBlackStyles,
  white: WhiteStyles
};
const Link = ({
  className = "",
  label = "",
  showChevron = false,
  size = "caption",
  state = "default",
  color = "blackWhite",
  icon,
  href = "#",
  openNewTab = false
}) => {
  const styles = linkStyles[color];
  const linkId = `quill-link-${color}-${size}-${state}`;
  const chevronIcon = {
    caption: ForwardRef$4,
    sm: ForwardRef$3,
    md: ForwardRef$2,
    lg: ForwardRef$1,
    xl: ForwardRef
  };
  const ChevronIcon = chevronIcon[size];
  return /* @__PURE__ */ jsxs(
    "a",
    {
      href,
      target: openNewTab ? "_blank" : void 0,
      className: [
        styles.root,
        className,
        "quill-ui-next-component",
        state !== "disabled" ? "quill-ui-next-pointer" : "quill-ui-next-pointer-disabled"
      ].join(" "),
      "data-id": linkId,
      "data-size": size,
      "data-state": state,
      onClick: (e) => {
        if (state === "disabled") {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      },
      tabIndex: state === "disabled" ? -1 : 0,
      "aria-disabled": state === "disabled",
      children: [
        icon && /* @__PURE__ */ jsx("div", { className: styles.icon1, children: icon }),
        /* @__PURE__ */ jsx("div", { className: styles.label, children: label }),
        showChevron && /* @__PURE__ */ jsx("div", { className: styles.iconChevron, children: ChevronIcon && /* @__PURE__ */ jsx(ChevronIcon, {}) })
      ]
    }
  );
};
Link.displayName = "Link";
export {
  Link,
  Link as default
};
//# sourceMappingURL=index10.mjs.map
