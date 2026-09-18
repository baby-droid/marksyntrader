"use strict";
const jsxRuntime = require("react/jsx-runtime");
const CardBasicHorizontal_module = require("./index160.cjs");
const quillIcons = require("@deriv/quill-icons");
const index = require("./index36.cjs");
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
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [
        CardBasicHorizontal_module.default.root,
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
        image && /* @__PURE__ */ jsxRuntime.jsx("img", { className: CardBasicHorizontal_module.default.placeholderImage11, alt: "", src: image }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: CardBasicHorizontal_module.default.containerBody, children: [
          (iconLeft || iconRight) && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: CardBasicHorizontal_module.default.containerIcon, children: [
            iconLeft && /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${CardBasicHorizontal_module.default.iconLeft} card-icon`, children: iconLeft }),
            iconRight && /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${CardBasicHorizontal_module.default.iconRight} card-icon`, children: iconRight })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: CardBasicHorizontal_module.default.containerContentaction, children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: CardBasicHorizontal_module.default.containerContent, children: (title || subtitle) && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: CardBasicHorizontal_module.default.titlesubtitle, children: [
              title && /* @__PURE__ */ jsxRuntime.jsx("b", { className: CardBasicHorizontal_module.default.title, children: title }),
              subtitle && /* @__PURE__ */ jsxRuntime.jsx("div", { className: CardBasicHorizontal_module.default.subtitle, children: subtitle }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: CardBasicHorizontal_module.default.description, children: description })
            ] }) }),
            linkLabel && /* @__PURE__ */ jsxRuntime.jsxs(
              "div",
              {
                className: `${CardBasicHorizontal_module.default.actionLink} ${linkOnClick ? "quill-ui-next-pointer" : ""}`,
                onClick: linkOnClick,
                children: [
                  linkIcon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${CardBasicHorizontal_module.default.customIcon} card-icon`, children: linkIcon }),
                  /* @__PURE__ */ jsxRuntime.jsx("div", { className: CardBasicHorizontal_module.default.label, children: linkLabel }),
                  /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${CardBasicHorizontal_module.default.iconChevron} card-icon`, children: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronRightSmRegularIcon, {}) })
                ]
              }
            ),
            (primaryHorizontalButton || secondaryHorizontalButton) && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: CardBasicHorizontal_module.default.actionHorizontalButton, children: [
              secondaryHorizontalButton && /* @__PURE__ */ jsxRuntime.jsx(
                index.BasicButton,
                {
                  ...secondaryHorizontalButton,
                  style: "secondary",
                  width: "fill container",
                  size,
                  color: "blackWhite"
                }
              ),
              primaryHorizontalButton && /* @__PURE__ */ jsxRuntime.jsx(
                index.BasicButton,
                {
                  ...primaryHorizontalButton,
                  style: "primary",
                  width: "fill container",
                  size,
                  color: "blackWhite"
                }
              )
            ] }),
            (primaryVerticalButton || secondaryVerticalButton) && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: CardBasicHorizontal_module.default.actionVerticalButton, children: [
              secondaryVerticalButton && /* @__PURE__ */ jsxRuntime.jsx(
                index.BasicButton,
                {
                  ...secondaryVerticalButton,
                  style: "secondary",
                  width: "fill container",
                  size,
                  color: "blackWhite"
                }
              ),
              primaryVerticalButton && /* @__PURE__ */ jsxRuntime.jsx(
                index.BasicButton,
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
        focus && /* @__PURE__ */ jsxRuntime.jsx("div", { className: CardBasicHorizontal_module.default.bgFocus4 })
      ]
    }
  );
};
module.exports = CardHorizontalLayout;
//# sourceMappingURL=index114.cjs.map
