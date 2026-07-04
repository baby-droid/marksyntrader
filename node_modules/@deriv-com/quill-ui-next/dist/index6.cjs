"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const Snackbar_module = require("./index70.cjs");
const quillIcons = require("@deriv/quill-icons");
require("react-dom");
require("react");
const Snackbar = ({
  className = "",
  indicator = "neutral",
  type = "mobile",
  message = "Message goes here",
  showButtonAction = true,
  showButtonClose = true,
  showIcon = true,
  actionLabel = "Action",
  onActionClick,
  onCloseClick
}) => {
  const SnackbarId = `quill-snackbar-${indicator}-${type}`;
  const defaultIcons = {
    neutral: quillIcons.StandaloneCircleInfoBoldIcon,
    fail: quillIcons.StandaloneTriangleExclamationBoldIcon
  };
  const IconComponent = defaultIcons[indicator];
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [Snackbar_module.default.root, className].join(" "),
      "data-indicator": indicator,
      "data-type": type,
      "data-id": SnackbarId,
      children: [
        showIcon && /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${Snackbar_module.default.icon1} snackbar-icon`, children: /* @__PURE__ */ jsxRuntime.jsx(IconComponent, { iconSize: "sm" }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: Snackbar_module.default.containerMessage, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: Snackbar_module.default.message, children: message }) }),
        showButtonAction && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: Snackbar_module.default.buttonAction, children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              className: Snackbar_module.default.label,
              onClick: onActionClick,
              style: {
                cursor: "pointer"
              },
              children: actionLabel
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: Snackbar_module.default.bgFocus })
        ] }),
        showButtonClose && /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            className: Snackbar_module.default.buttonClose,
            onClick: onCloseClick,
            style: { cursor: "pointer" },
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${Snackbar_module.default.icon6} snackbar-icon`, children: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedXmarkSmRegularIcon, {}) }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: Snackbar_module.default.bgFocus1 })
            ]
          }
        )
      ]
    }
  );
};
exports.Snackbar = Snackbar;
exports.default = Snackbar;
//# sourceMappingURL=index6.cjs.map
