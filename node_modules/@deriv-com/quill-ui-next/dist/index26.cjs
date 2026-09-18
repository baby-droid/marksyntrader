"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index94.cjs");
const quillIcons = require("@deriv/quill-icons");
const PasswordField = (props) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const handleTogglePassword = () => {
    if (props.state !== "disabled") {
      setShowPassword((prev) => !prev);
    }
  };
  const eyeIcon = showPassword ? /* @__PURE__ */ jsxRuntime.jsx(
    quillIcons.LabelPairedEyeSlashSmBoldIcon,
    {
      className: "quill-ui-next-pointer",
      onClick: handleTogglePassword
    }
  ) : /* @__PURE__ */ jsxRuntime.jsx(
    quillIcons.LabelPairedEyeSmBoldIcon,
    {
      className: "quill-ui-next-pointer",
      onClick: handleTogglePassword
    }
  );
  return /* @__PURE__ */ jsxRuntime.jsx(
    index,
    {
      label: "Password",
      placeholder: "Enter your password",
      ...props,
      inputType: showPassword ? "text" : "password",
      iconLeft: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedLockSmBoldIcon, {}),
      iconRight: eyeIcon,
      showStatusIcon: true
    }
  );
};
PasswordField.displayName = "PasswordField";
exports.PasswordField = PasswordField;
exports.default = PasswordField;
//# sourceMappingURL=index26.cjs.map
