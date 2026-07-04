import { jsx } from "react/jsx-runtime";
import TextFieldAtom from "./index94.mjs";
import styles from "./index108.mjs";
const TextArea = (props) => {
  return /* @__PURE__ */ jsx(
    TextFieldAtom,
    {
      ...props,
      inputElement: "textarea",
      className: styles.root,
      maxLength: props.maxLength || 300
    }
  );
};
TextArea.displayName = "TextArea";
export {
  TextArea,
  TextArea as default
};
//# sourceMappingURL=index23.mjs.map
