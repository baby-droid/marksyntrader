import { jsx } from "react/jsx-runtime";
import { useState } from "react";
import TextFieldAtom from "./index94.mjs";
import { LabelPairedLockSmBoldIcon, LabelPairedEyeSlashSmBoldIcon, LabelPairedEyeSmBoldIcon } from "@deriv/quill-icons";
const PasswordField = (props) => {
  const [showPassword, setShowPassword] = useState(false);
  const handleTogglePassword = () => {
    if (props.state !== "disabled") {
      setShowPassword((prev) => !prev);
    }
  };
  const eyeIcon = showPassword ? /* @__PURE__ */ jsx(
    LabelPairedEyeSlashSmBoldIcon,
    {
      className: "quill-ui-next-pointer",
      onClick: handleTogglePassword
    }
  ) : /* @__PURE__ */ jsx(
    LabelPairedEyeSmBoldIcon,
    {
      className: "quill-ui-next-pointer",
      onClick: handleTogglePassword
    }
  );
  return /* @__PURE__ */ jsx(
    TextFieldAtom,
    {
      label: "Password",
      placeholder: "Enter your password",
      ...props,
      inputType: showPassword ? "text" : "password",
      iconLeft: /* @__PURE__ */ jsx(LabelPairedLockSmBoldIcon, {}),
      iconRight: eyeIcon,
      showStatusIcon: true
    }
  );
};
PasswordField.displayName = "PasswordField";
export {
  PasswordField,
  PasswordField as default
};
//# sourceMappingURL=index26.mjs.map
