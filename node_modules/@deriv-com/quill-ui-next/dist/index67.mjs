import { jsx } from "react/jsx-runtime";
import styles from "./index126.mjs";
import { LabelPairedCircleExclamationLgFillIcon, LabelPairedCircleExclamationMdFillIcon, LabelPairedCircleExclamationCaptionFillIcon, LabelPairedCircleXmarkLgFillIcon, LabelPairedCircleXmarkMdFillIcon, LabelPairedCircleXmarkCaptionFillIcon, LabelPairedExclamationMdBoldIcon, LabelPairedExclamationSmBoldIcon, LabelPairedExclamationCaptionBoldIcon, LabelPairedXmarkMdBoldIcon, LabelPairedXmarkSmBoldIcon, LabelPairedXmarkCaptionBoldIcon, LabelPairedCheckMdBoldIcon, LabelPairedCheckSmBoldIcon, LabelPairedCheckCaptionBoldIcon } from "@deriv/quill-icons";
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
      sm: /* @__PURE__ */ jsx(LabelPairedCheckCaptionBoldIcon, {}),
      md: /* @__PURE__ */ jsx(LabelPairedCheckSmBoldIcon, {}),
      lg: /* @__PURE__ */ jsx(LabelPairedCheckMdBoldIcon, {})
    },
    fail: {
      sm: /* @__PURE__ */ jsx(LabelPairedXmarkCaptionBoldIcon, {}),
      md: /* @__PURE__ */ jsx(LabelPairedXmarkSmBoldIcon, {}),
      lg: /* @__PURE__ */ jsx(LabelPairedXmarkMdBoldIcon, {})
    },
    warning: {
      sm: /* @__PURE__ */ jsx(LabelPairedExclamationCaptionBoldIcon, {}),
      md: /* @__PURE__ */ jsx(LabelPairedExclamationSmBoldIcon, {}),
      lg: /* @__PURE__ */ jsx(LabelPairedExclamationMdBoldIcon, {})
    },
    icon: {
      fail: {
        sm: /* @__PURE__ */ jsx(LabelPairedCircleXmarkCaptionFillIcon, {}),
        md: /* @__PURE__ */ jsx(LabelPairedCircleXmarkMdFillIcon, {}),
        lg: /* @__PURE__ */ jsx(LabelPairedCircleXmarkLgFillIcon, {})
      },
      warning: {
        sm: /* @__PURE__ */ jsx(LabelPairedCircleExclamationCaptionFillIcon, {}),
        md: /* @__PURE__ */ jsx(LabelPairedCircleExclamationMdFillIcon, {}),
        lg: /* @__PURE__ */ jsx(LabelPairedCircleExclamationLgFillIcon, {})
      }
    }
  };
  let content = null;
  if (marker === "number") {
    content = /* @__PURE__ */ jsx("b", { className: styles.number, children: text });
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
    return /* @__PURE__ */ jsx(
      "div",
      {
        className: [styles.icon, className].join(" "),
        "data-size": size,
        "data-type": type,
        "data-indicator": indicator,
        children: content
      }
    );
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: [styles.root, className].join(" "),
      "data-size": size,
      "data-type": type,
      "data-indicator": indicator,
      children: content && content
    }
  );
};
export {
  SteppersMarkerAtom as default
};
//# sourceMappingURL=index67.mjs.map
