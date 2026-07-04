import { jsxs, jsx } from "react/jsx-runtime";
import styles from "./index70.mjs";
import { StandaloneTriangleExclamationBoldIcon, StandaloneCircleInfoBoldIcon, LabelPairedXmarkSmRegularIcon } from "@deriv/quill-icons";
import "react-dom";
import "react";
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
    neutral: StandaloneCircleInfoBoldIcon,
    fail: StandaloneTriangleExclamationBoldIcon
  };
  const IconComponent = defaultIcons[indicator];
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [styles.root, className].join(" "),
      "data-indicator": indicator,
      "data-type": type,
      "data-id": SnackbarId,
      children: [
        showIcon && /* @__PURE__ */ jsx("div", { className: `${styles.icon1} snackbar-icon`, children: /* @__PURE__ */ jsx(IconComponent, { iconSize: "sm" }) }),
        /* @__PURE__ */ jsx("div", { className: styles.containerMessage, children: /* @__PURE__ */ jsx("div", { className: styles.message, children: message }) }),
        showButtonAction && /* @__PURE__ */ jsxs("div", { className: styles.buttonAction, children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: styles.label,
              onClick: onActionClick,
              style: {
                cursor: "pointer"
              },
              children: actionLabel
            }
          ),
          /* @__PURE__ */ jsx("div", { className: styles.bgFocus })
        ] }),
        showButtonClose && /* @__PURE__ */ jsxs(
          "div",
          {
            className: styles.buttonClose,
            onClick: onCloseClick,
            style: { cursor: "pointer" },
            children: [
              /* @__PURE__ */ jsx("div", { className: `${styles.icon6} snackbar-icon`, children: /* @__PURE__ */ jsx(LabelPairedXmarkSmRegularIcon, {}) }),
              /* @__PURE__ */ jsx("div", { className: styles.bgFocus1 })
            ]
          }
        )
      ]
    }
  );
};
export {
  Snackbar,
  Snackbar as default
};
//# sourceMappingURL=index6.mjs.map
