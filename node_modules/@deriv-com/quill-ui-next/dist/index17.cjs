"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const NotificationStatusIcon_module = require("./index93.cjs");
const quillIcons = require("@deriv/quill-icons");
;/* empty css         */
require("./index3.cjs");
require("./index4.cjs");
require("./index5.cjs");
require("react-dom");
require("react");
require("./index7.cjs");
require("./index8.cjs");
require("./index9.cjs");
require("./index10.cjs");
require("./index12.cjs");
require("./index20.cjs");
require("./index21.cjs");
require("./index36.cjs");
require("./index23.cjs");
require("./index94.cjs");
require("./index25.cjs");
require("./index26.cjs");
require("framer-motion");
require("./index95.cjs");
;/* empty css          */
;/* empty css          */
require("react-calendar");
require("date-fns");
require("./index98.cjs");
require("./index35.cjs");
require("./index99.cjs");
require("./index31.cjs");
const index = require("./index37.cjs");
require("./index38.cjs");
require("./index39.cjs");
require("./index40.cjs");
require("./index41.cjs");
require("./index42.cjs");
require("./index43.cjs");
const NotificationStatusIcon = ({ className = "", type = "informative", showBadge = true, style }) => {
  const statusId = `notification-status-icon-${type}`;
  const iconType = {
    informative: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCircleInfoSmBoldIcon, {}),
    success: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCircleCheckSmBoldIcon, {}),
    warning: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedTriangleExclamationSmBoldIcon, {}),
    danger: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCircleExclamationSmBoldIcon, {})
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [NotificationStatusIcon_module.default.root, className].join(" "),
      "data-id": statusId,
      "data-type": type,
      style,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: `${NotificationStatusIcon_module.default.containerIcon} notification-icon`, children: iconType[type] }),
        showBadge && /* @__PURE__ */ jsxRuntime.jsx("div", { className: NotificationStatusIcon_module.default.badgeContainer, children: /* @__PURE__ */ jsxRuntime.jsx(index.BadgeNotification, { size: "sm", showLabel: false }) })
      ]
    }
  );
};
exports.NotificationStatusIcon = NotificationStatusIcon;
exports.default = NotificationStatusIcon;
//# sourceMappingURL=index17.cjs.map
