import { jsxs, jsx } from "react/jsx-runtime";
import styles from "./index93.mjs";
import { LabelPairedCircleExclamationSmBoldIcon, LabelPairedTriangleExclamationSmBoldIcon, LabelPairedCircleCheckSmBoldIcon, LabelPairedCircleInfoSmBoldIcon } from "@deriv/quill-icons";
/* empty css        */
import "./index3.mjs";
import "./index4.mjs";
import "./index5.mjs";
import "react-dom";
import "react";
import "./index7.mjs";
import "./index8.mjs";
import "./index9.mjs";
import "./index10.mjs";
import "./index12.mjs";
import "./index20.mjs";
import "./index21.mjs";
import "./index36.mjs";
import "./index23.mjs";
import "./index94.mjs";
import "./index25.mjs";
import "./index26.mjs";
import "framer-motion";
import "./index95.mjs";
/* empty css         */
/* empty css         */
import "react-calendar";
import "date-fns";
import "./index98.mjs";
import "./index35.mjs";
import "./index99.mjs";
import "./index31.mjs";
import { BadgeNotification } from "./index37.mjs";
import "./index38.mjs";
import "./index39.mjs";
import "./index40.mjs";
import "./index41.mjs";
import "./index42.mjs";
import "./index43.mjs";
const NotificationStatusIcon = ({ className = "", type = "informative", showBadge = true, style }) => {
  const statusId = `notification-status-icon-${type}`;
  const iconType = {
    informative: /* @__PURE__ */ jsx(LabelPairedCircleInfoSmBoldIcon, {}),
    success: /* @__PURE__ */ jsx(LabelPairedCircleCheckSmBoldIcon, {}),
    warning: /* @__PURE__ */ jsx(LabelPairedTriangleExclamationSmBoldIcon, {}),
    danger: /* @__PURE__ */ jsx(LabelPairedCircleExclamationSmBoldIcon, {})
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [styles.root, className].join(" "),
      "data-id": statusId,
      "data-type": type,
      style,
      children: [
        /* @__PURE__ */ jsx("div", { className: `${styles.containerIcon} notification-icon`, children: iconType[type] }),
        showBadge && /* @__PURE__ */ jsx("div", { className: styles.badgeContainer, children: /* @__PURE__ */ jsx(BadgeNotification, { size: "sm", showLabel: false }) })
      ]
    }
  );
};
export {
  NotificationStatusIcon,
  NotificationStatusIcon as default
};
//# sourceMappingURL=index17.mjs.map
