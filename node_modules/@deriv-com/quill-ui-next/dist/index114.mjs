import { jsxs, jsx } from "react/jsx-runtime";
import styles from "./index160.mjs";
import { LabelPairedChevronRightSmRegularIcon } from "@deriv/quill-icons";
import { BasicButton } from "./index36.mjs";
const CardHorizontalLayout = ({
  cardId,
  className,
  size,
  state,
  type,
  focus,
  handleFocus,
  handleBlur,
  isClickable,
  title,
  subtitle,
  description,
  image,
  iconLeft,
  iconRight,
  linkLabel,
  linkIcon,
  linkOnClick,
  primaryVerticalButton,
  secondaryVerticalButton,
  primaryHorizontalButton,
  secondaryHorizontalButton
}) => {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [
        styles.root,
        className,
        isClickable ? "quill-ui-next-component" : ""
      ].join(" "),
      "data-size": size,
      "data-state": state,
      "data-type": type,
      "data-id": cardId,
      role: isClickable ? "button" : void 0,
      tabIndex: isClickable ? 0 : void 0,
      onFocus: handleFocus,
      onBlur: handleBlur,
      children: [
        image && /* @__PURE__ */ jsx("img", { className: styles.placeholderImage11, alt: "", src: image }),
        /* @__PURE__ */ jsxs("div", { className: styles.containerBody, children: [
          (iconLeft || iconRight) && /* @__PURE__ */ jsxs("div", { className: styles.containerIcon, children: [
            iconLeft && /* @__PURE__ */ jsx("div", { className: `${styles.iconLeft} card-icon`, children: iconLeft }),
            iconRight && /* @__PURE__ */ jsx("div", { className: `${styles.iconRight} card-icon`, children: iconRight })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: styles.containerContentaction, children: [
            /* @__PURE__ */ jsx("div", { className: styles.containerContent, children: (title || subtitle) && /* @__PURE__ */ jsxs("div", { className: styles.titlesubtitle, children: [
              title && /* @__PURE__ */ jsx("b", { className: styles.title, children: title }),
              subtitle && /* @__PURE__ */ jsx("div", { className: styles.subtitle, children: subtitle }),
              /* @__PURE__ */ jsx("div", { className: styles.description, children: description })
            ] }) }),
            linkLabel && /* @__PURE__ */ jsxs(
              "div",
              {
                className: `${styles.actionLink} ${linkOnClick ? "quill-ui-next-pointer" : ""}`,
                onClick: linkOnClick,
                children: [
                  linkIcon && /* @__PURE__ */ jsx("div", { className: `${styles.customIcon} card-icon`, children: linkIcon }),
                  /* @__PURE__ */ jsx("div", { className: styles.label, children: linkLabel }),
                  /* @__PURE__ */ jsx("div", { className: `${styles.iconChevron} card-icon`, children: /* @__PURE__ */ jsx(LabelPairedChevronRightSmRegularIcon, {}) })
                ]
              }
            ),
            (primaryHorizontalButton || secondaryHorizontalButton) && /* @__PURE__ */ jsxs("div", { className: styles.actionHorizontalButton, children: [
              secondaryHorizontalButton && /* @__PURE__ */ jsx(
                BasicButton,
                {
                  ...secondaryHorizontalButton,
                  style: "secondary",
                  width: "fill container",
                  size,
                  color: "blackWhite"
                }
              ),
              primaryHorizontalButton && /* @__PURE__ */ jsx(
                BasicButton,
                {
                  ...primaryHorizontalButton,
                  style: "primary",
                  width: "fill container",
                  size,
                  color: "blackWhite"
                }
              )
            ] }),
            (primaryVerticalButton || secondaryVerticalButton) && /* @__PURE__ */ jsxs("div", { className: styles.actionVerticalButton, children: [
              secondaryVerticalButton && /* @__PURE__ */ jsx(
                BasicButton,
                {
                  ...secondaryVerticalButton,
                  style: "secondary",
                  width: "fill container",
                  size,
                  color: "blackWhite"
                }
              ),
              primaryVerticalButton && /* @__PURE__ */ jsx(
                BasicButton,
                {
                  ...primaryVerticalButton,
                  style: "primary",
                  width: "fill container",
                  size,
                  color: "blackWhite"
                }
              )
            ] })
          ] })
        ] }),
        focus && /* @__PURE__ */ jsx("div", { className: styles.bgFocus4 })
      ]
    }
  );
};
export {
  CardHorizontalLayout as default
};
//# sourceMappingURL=index114.mjs.map
