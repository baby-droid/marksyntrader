"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const SectionMessage_module = require("./index73.cjs");
const index = require("./index10.cjs");
const quillIcons = require("@deriv/quill-icons");
const index$2 = require("./index35.cjs");
const index$1 = require("./index36.cjs");
const SectionMessage = ({
  className = "",
  indicator = "danger",
  size = "sm",
  message = "",
  title = "",
  customIcon,
  showIcon = true,
  showCloseButton = false,
  link1,
  link2,
  buttonPrimary,
  buttonSecondary,
  onClickClose
}) => {
  const sectionMessageId = `quill-section-message-${indicator}-${size}`;
  const defaultIcons = {
    danger: quillIcons.StandaloneTriangleExclamationBoldIcon,
    warning: quillIcons.StandaloneCircleExclamationBoldIcon,
    success: quillIcons.StandaloneCircleCheckBoldIcon,
    information: quillIcons.StandaloneCircleInfoBoldIcon,
    default: quillIcons.StandalonePlaceholderBoldIcon
  };
  const IconComponent = defaultIcons[indicator];
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [SectionMessage_module.default.root, "quill-ui-next-component", className].join(" "),
      "data-id": sectionMessageId,
      "data-indicator": indicator,
      "data-size": size,
      children: [
        showIcon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: SectionMessage_module.default.fixIcon, children: indicator === "default" && customIcon ? customIcon : IconComponent && // @ts-ignore
        /* @__PURE__ */ jsxRuntime.jsx(IconComponent, { iconSize: size === "md" ? "md" : "sm" }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: SectionMessage_module.default.titleMessageButtons, children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: SectionMessage_module.default.titleMessage, children: [
            title && /* @__PURE__ */ jsxRuntime.jsx("b", { className: SectionMessage_module.default.title, children: title }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: SectionMessage_module.default.containerMessage, children: /* @__PURE__ */ jsxRuntime.jsx(
              "div",
              {
                className: `${SectionMessage_module.default.message} ${!title ? SectionMessage_module.default.noTitleMessage : ""}`,
                children: message
              }
            ) })
          ] }),
          link1 ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: SectionMessage_module.default.link1Link2, children: [
            /* @__PURE__ */ jsxRuntime.jsx(index.Link, { ...link1, size, color: "blackWhite" }),
            link2 && /* @__PURE__ */ jsxRuntime.jsx(index.Link, { ...link2, size, color: "blackWhite" })
          ] }) : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: SectionMessage_module.default.buttonContainer, children: [
            buttonPrimary && /* @__PURE__ */ jsxRuntime.jsx(
              index$1.BasicButton,
              {
                ...buttonPrimary,
                style: "secondary",
                color: "blackWhite"
              }
            ),
            buttonSecondary && /* @__PURE__ */ jsxRuntime.jsx(
              index$1.BasicButton,
              {
                ...buttonSecondary,
                style: "primary",
                color: "blackWhite",
                size: size === "md" ? "md" : "sm"
              }
            )
          ] })
        ] }),
        showCloseButton && /* @__PURE__ */ jsxRuntime.jsx(
          index$2.IconButton,
          {
            color: "blackWhite",
            icon: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedXmarkCaptionBoldIcon, {}),
            style: "tertiary",
            onClick: onClickClose
          }
        )
      ]
    }
  );
};
SectionMessage.displayName = "SectionMessage";
exports.SectionMessage = SectionMessage;
exports.default = SectionMessage;
//# sourceMappingURL=index8.cjs.map
