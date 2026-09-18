import { jsx } from "react/jsx-runtime";
import { useState } from "react";
import TextFieldAtom from "./index94.mjs";
import { LabelPairedCircleXmarkSmFillIcon, LabelPairedSearchSmBoldIcon } from "@deriv/quill-icons";
import { hasInputValue } from "./index109.mjs";
const SearchField = (props) => {
  const [value, setValue] = useState(props.value);
  return /* @__PURE__ */ jsx(
    TextFieldAtom,
    {
      labelLeft: props.label,
      placeholder: "Search",
      ...props,
      iconLeft: /* @__PURE__ */ jsx(LabelPairedSearchSmBoldIcon, {}),
      iconRight: hasInputValue(value) && /* @__PURE__ */ jsx(
        LabelPairedCircleXmarkSmFillIcon,
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
export {
  SearchField,
  SearchField as default
};
//# sourceMappingURL=index24.mjs.map
