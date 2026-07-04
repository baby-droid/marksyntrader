import { jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import TextFieldAtom from "./index94.mjs";
import { IconButton } from "./index35.mjs";
import { LabelPairedPlusSmBoldIcon, LabelPairedMinusSmBoldIcon } from "@deriv/quill-icons";
const TextFieldStepper = ({
  maxValue = 1e3,
  minValue = 0,
  decimalPlaces = 0,
  value: initialValue,
  variant = "labelled",
  state,
  onChange,
  increment = 1,
  split = false,
  ...props
}) => {
  const [value, setValue] = useState(initialValue ?? 0);
  const handleChange = (value2) => {
    const formattedValue = formatFloats(value2);
    setValue(formattedValue);
    onChange == null ? void 0 : onChange(formattedValue);
  };
  const formatFloats = (value2) => {
    if (value2 === null || value2 === "" || isNaN(Number(value2))) {
      return 0;
    }
    let numValue = Number(value2);
    if (!Number.isFinite(numValue) || numValue > maxValue) {
      return maxValue;
    }
    if (numValue < minValue) {
      return minValue;
    }
    return Number(numValue.toFixed(decimalPlaces));
  };
  const validateInput = (nextChar) => {
    const disallowedKeys = ["e", "E"];
    if (disallowedKeys.includes(nextChar.toString())) return false;
    return true;
  };
  useEffect(() => {
    if (value !== void 0) {
      const formattedValue = parseFloat(value.toString()).toFixed(
        decimalPlaces
      );
      setValue(formattedValue);
    }
  }, [value, maxValue, decimalPlaces]);
  const minusButton = /* @__PURE__ */ jsx(
    IconButton,
    {
      style: "tertiary",
      size: "sm",
      state: state === "disabled" ? "disabled" : "default",
      icon: /* @__PURE__ */ jsx(LabelPairedMinusSmBoldIcon, {}),
      onClick: () => handleChange(Number(value || 0) - Number(increment)),
      color: "black"
    }
  );
  const plusButton = /* @__PURE__ */ jsx(
    IconButton,
    {
      style: "tertiary",
      size: "sm",
      state: state === "disabled" ? "disabled" : "default",
      icon: /* @__PURE__ */ jsx(LabelPairedPlusSmBoldIcon, {}),
      onClick: () => handleChange(Number(value || 0) + Number(increment)),
      color: "black"
    }
  );
  let iconExtra, iconLeft, iconRight, textAlignment = "left";
  iconRight = plusButton;
  if (split) {
    iconLeft = minusButton;
    textAlignment = "center";
  } else {
    iconExtra = minusButton;
  }
  return /* @__PURE__ */ jsx(
    TextFieldAtom,
    {
      ...props,
      inputType: "number",
      onChange: handleChange,
      value,
      state,
      variant,
      iconExtra,
      iconLeft,
      iconRight,
      textAlignment,
      onBeforeChange: (nextChar) => validateInput(nextChar)
    }
  );
};
TextFieldStepper.displayName = "TextFieldStepper";
export {
  TextFieldStepper,
  TextFieldStepper as default
};
//# sourceMappingURL=index42.mjs.map
