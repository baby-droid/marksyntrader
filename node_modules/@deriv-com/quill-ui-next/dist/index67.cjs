"use strict";
const jsxRuntime = require("react/jsx-runtime");
const SteppersMarker_module = require("./index126.cjs");
const quillIcons = require("@deriv/quill-icons");
const SteppersMarkerAtom = ({
  className = "",
  size = "sm",
  type = "inactive",
  marker = "dot",
  text = "1",
  indicator = "default",
  icon
}) => {
  const icons = {
    complete: {
      sm: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCheckCaptionBoldIcon, {}),
      md: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCheckSmBoldIcon, {}),
      lg: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCheckMdBoldIcon, {})
    },
    fail: {
      sm: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedXmarkCaptionBoldIcon, {}),
      md: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedXmarkSmBoldIcon, {}),
      lg: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedXmarkMdBoldIcon, {})
    },
    warning: {
      sm: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedExclamationCaptionBoldIcon, {}),
      md: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedExclamationSmBoldIcon, {}),
      lg: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedExclamationMdBoldIcon, {})
    },
    icon: {
      fail: {
        sm: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCircleXmarkCaptionFillIcon, {}),
        md: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCircleXmarkMdFillIcon, {}),
        lg: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCircleXmarkLgFillIcon, {})
      },
      warning: {
        sm: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCircleExclamationCaptionFillIcon, {}),
        md: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCircleExclamationMdFillIcon, {}),
        lg: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCircleExclamationLgFillIcon, {})
      }
    }
  };
  let content = null;
  if (marker === "number") {
    content = /* @__PURE__ */ jsxRuntime.jsx("b", { className: SteppersMarker_module.default.number, children: text });
  }
  if (type === "complete") {
    content = icons.complete[size];
  }
  if (indicator === "fail" || indicator === "warning") {
    content = icons[indicator][size];
  }
  if (marker === "icon") {
    content = icon;
    if (indicator === "fail" || indicator === "warning") {
      content = icons.icon[indicator][size];
    }
    return /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        className: [SteppersMarker_module.default.icon, className].join(" "),
        "data-size": size,
        "data-type": type,
        "data-indicator": indicator,
        children: content
      }
    );
  }
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      className: [SteppersMarker_module.default.root, className].join(" "),
      "data-size": size,
      "data-type": type,
      "data-indicator": indicator,
      children: content && content
    }
  );
};
module.exports = SteppersMarkerAtom;
//# sourceMappingURL=index67.cjs.map
