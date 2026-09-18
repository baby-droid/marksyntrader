import { jsxs, jsx } from "react/jsx-runtime";
import styles from "./index73.mjs";
import { Link } from "./index10.mjs";
import { StandalonePlaceholderBoldIcon, StandaloneCircleInfoBoldIcon, StandaloneCircleCheckBoldIcon, StandaloneCircleExclamationBoldIcon, StandaloneTriangleExclamationBoldIcon, LabelPairedXmarkCaptionBoldIcon } from "@deriv/quill-icons";
import { IconButton } from "./index35.mjs";
import { BasicButton } from "./index36.mjs";
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
    danger: StandaloneTriangleExclamationBoldIcon,
    warning: StandaloneCircleExclamationBoldIcon,
    success: StandaloneCircleCheckBoldIcon,
    information: StandaloneCircleInfoBoldIcon,
    default: StandalonePlaceholderBoldIcon
  };
  const IconComponent = defaultIcons[indicator];
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [styles.root, "quill-ui-next-component", className].join(" "),
      "data-id": sectionMessageId,
      "data-indicator": indicator,
      "data-size": size,
      children: [
        showIcon && /* @__PURE__ */ jsx("div", { className: styles.fixIcon, children: indicator === "default" && customIcon ? customIcon : IconComponent && // @ts-ignore
        /* @__PURE__ */ jsx(IconComponent, { iconSize: size === "md" ? "md" : "sm" }) }),
        /* @__PURE__ */ jsxs("div", { className: styles.titleMessageButtons, children: [
          /* @__PURE__ */ jsxs("div", { className: styles.titleMessage, children: [
            title && /* @__PURE__ */ jsx("b", { className: styles.title, children: title }),
            /* @__PURE__ */ jsx("div", { className: styles.containerMessage, children: /* @__PURE__ */ jsx(
              "div",
              {
                className: `${styles.message} ${!title ? styles.noTitleMessage : ""}`,
                children: message
              }
            ) })
          ] }),
          link1 ? /* @__PURE__ */ jsxs("div", { className: styles.link1Link2, children: [
            /* @__PURE__ */ jsx(Link, { ...link1, size, color: "blackWhite" }),
            link2 && /* @__PURE__ */ jsx(Link, { ...link2, size, color: "blackWhite" })
          ] }) : /* @__PURE__ */ jsxs("div", { className: styles.buttonContainer, children: [
            buttonPrimary && /* @__PURE__ */ jsx(
              BasicButton,
              {
                ...buttonPrimary,
                style: "secondary",
                color: "blackWhite"
              }
            ),
            buttonSecondary && /* @__PURE__ */ jsx(
              BasicButton,
              {
                ...buttonSecondary,
                style: "primary",
                color: "blackWhite",
                size: size === "md" ? "md" : "sm"
              }
            )
          ] })
        ] }),
        showCloseButton && /* @__PURE__ */ jsx(
          IconButton,
          {
            color: "blackWhite",
            icon: /* @__PURE__ */ jsx(LabelPairedXmarkCaptionBoldIcon, {}),
            style: "tertiary",
            onClick: onClickClose
          }
        )
      ]
    }
  );
};
SectionMessage.displayName = "SectionMessage";
export {
  SectionMessage,
  SectionMessage as default
};
//# sourceMappingURL=index8.mjs.map
