"use strict";
const jsxRuntime = require("react/jsx-runtime");
const BaseTypography_module = require("./index136.cjs");
const BaseTypography = ({
  className = "",
  children,
  type,
  size = "md",
  bold = false,
  level = 1,
  as
}) => {
  const getElementType = () => {
    if (as) return as;
    if (type === "heading") {
      if (level === "mega") return "h1";
      return `h${level}`;
    }
    if (type === "caption") return "caption";
    if (type === "code") return "code";
    return "span";
  };
  const Element = getElementType();
  const componentId = `quill-typography-${type}-${type === "body" || type === "code" ? size : level}`;
  return /* @__PURE__ */ jsxRuntime.jsx(
    Element,
    {
      className: [BaseTypography_module.default.root, className, "quill-ui-next-component"].join(" "),
      "data-id": componentId,
      "data-type": type,
      "data-size": type === "body" || type === "code" ? size : void 0,
      "data-level": type === "heading" ? level : void 0,
      "data-bold": bold,
      children
    }
  );
};
module.exports = BaseTypography;
//# sourceMappingURL=index90.cjs.map
