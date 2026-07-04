"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const Tag_module = require("./index56.cjs");
const LabelPairedCircleInfoSmRegularIcon = require("./index57.cjs");
const LabelPairedCircleInfoSmBoldIcon = require("./index58.cjs");
const LabelPairedCircleCheckSmRegularIcon = require("./index59.cjs");
const LabelPairedCircleCheckSmBoldIcon = require("./index60.cjs");
const LabelPairedCircleExclamationSmRegularIcon = require("./index61.cjs");
const LabelPairedCircleExclamationSmBoldIcon = require("./index62.cjs");
const LabelPairedTriangleExclamationSmRegularIcon = require("./index63.cjs");
const LabelPairedTriangleExclamationSmBoldIcon = require("./index64.cjs");
const stateIcons = {
  danger: {
    bold: /* @__PURE__ */ jsxRuntime.jsx(LabelPairedTriangleExclamationSmBoldIcon, {}),
    regular: /* @__PURE__ */ jsxRuntime.jsx(LabelPairedTriangleExclamationSmRegularIcon, {})
  },
  warning: {
    bold: /* @__PURE__ */ jsxRuntime.jsx(LabelPairedCircleExclamationSmBoldIcon, {}),
    regular: /* @__PURE__ */ jsxRuntime.jsx(LabelPairedCircleExclamationSmRegularIcon, {})
  },
  success: {
    bold: /* @__PURE__ */ jsxRuntime.jsx(LabelPairedCircleCheckSmBoldIcon, {}),
    regular: /* @__PURE__ */ jsxRuntime.jsx(LabelPairedCircleCheckSmRegularIcon, {})
  },
  information: {
    bold: /* @__PURE__ */ jsxRuntime.jsx(LabelPairedCircleInfoSmBoldIcon, {}),
    regular: /* @__PURE__ */ jsxRuntime.jsx(LabelPairedCircleInfoSmRegularIcon, {})
  }
};
const Tag = ({
  className = "",
  fontWeight = "regular",
  size = "sm",
  state = "custom",
  style = "fill",
  label,
  icon
}) => {
  var _a;
  const stateIcon = state !== "custom" ? (_a = stateIcons[state]) == null ? void 0 : _a[fontWeight] : icon;
  const tagId = `quill-tag-${state}`;
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [Tag_module.default.root, className, "quill-ui-next-component"].join(" "),
      "data-id": tagId,
      "data-fontWeight": fontWeight,
      "data-size": size,
      "data-state": state,
      "data-style": style,
      children: [
        stateIcon,
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: Tag_module.default.label, children: label === "" ? "Label" : label })
      ]
    }
  );
};
Tag.displayName = "Tag";
exports.Tag = Tag;
exports.default = Tag;
//# sourceMappingURL=index3.cjs.map
