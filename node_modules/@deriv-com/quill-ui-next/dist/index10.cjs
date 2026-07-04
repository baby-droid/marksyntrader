"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const LinkBlackWhite_module = require("./index76.cjs");
const LinkBlack_module = require("./index77.cjs");
const LinkWhiteBlack_module = require("./index78.cjs");
const LinkWhite_module = require("./index79.cjs");
const LabelPairedChevronRightXlRegularIcon = require("./index80.cjs");
const LabelPairedChevronRightLgRegularIcon = require("./index81.cjs");
const LabelPairedChevronRightMdRegularIcon = require("./index82.cjs");
const LabelPairedChevronRightSmRegularIcon = require("./index83.cjs");
const LabelPairedChevronRightCaptionRegularIcon = require("./index84.cjs");
const linkStyles = {
  blackWhite: LinkBlackWhite_module.default,
  black: LinkBlack_module.default,
  whiteBlack: LinkWhiteBlack_module.default,
  white: LinkWhite_module.default
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
    caption: LabelPairedChevronRightCaptionRegularIcon,
    sm: LabelPairedChevronRightSmRegularIcon,
    md: LabelPairedChevronRightMdRegularIcon,
    lg: LabelPairedChevronRightLgRegularIcon,
    xl: LabelPairedChevronRightXlRegularIcon
  };
  const ChevronIcon = chevronIcon[size];
  return /* @__PURE__ */ jsxRuntime.jsxs(
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
        icon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.icon1, children: icon }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.label, children: label }),
        showChevron && /* @__PURE__ */ jsxRuntime.jsx("div", { className: styles.iconChevron, children: ChevronIcon && /* @__PURE__ */ jsxRuntime.jsx(ChevronIcon, {}) })
      ]
    }
  );
};
Link.displayName = "Link";
exports.Link = Link;
exports.default = Link;
//# sourceMappingURL=index10.cjs.map
