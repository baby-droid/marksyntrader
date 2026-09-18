"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index94.cjs");
const quillIcons = require("@deriv/quill-icons");
const checkers = require("./index109.cjs");
const SearchField = (props) => {
  const [value, setValue] = React.useState(props.value);
  return /* @__PURE__ */ jsxRuntime.jsx(
    index,
    {
      labelLeft: props.label,
      placeholder: "Search",
      ...props,
      iconLeft: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedSearchSmBoldIcon, {}),
      iconRight: checkers.hasInputValue(value) && /* @__PURE__ */ jsxRuntime.jsx(
        quillIcons.LabelPairedCircleXmarkSmFillIcon,
        {
          className: "quill-ui-next-pointer",
          onClick: () => {
            var _a;
            setValue("");
            (_a = props.onChange) == null ? void 0 : _a.call(props, "");
          }
        }
      ),
      onChange: (e) => {
        var _a;
        setValue(e);
        (_a = props.onChange) == null ? void 0 : _a.call(props, e);
      },
      variant: "labelless",
      value,
      showStatusIcon: false
    }
  );
};
exports.SearchField = SearchField;
exports.default = SearchField;
//# sourceMappingURL=index24.cjs.map
