"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const index = require("./index94.cjs");
const Textarea_module = require("./index108.cjs");
const TextArea = (props) => {
  return /* @__PURE__ */ jsxRuntime.jsx(
    index,
    {
      ...props,
      inputElement: "textarea",
      className: Textarea_module.default.root,
      maxLength: props.maxLength || 300
    }
  );
};
TextArea.displayName = "TextArea";
exports.TextArea = TextArea;
exports.default = TextArea;
//# sourceMappingURL=index23.cjs.map
