import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { forwardRef, useState, useRef, useEffect } from "react";
import stylesLabelled from "./index133.mjs";
import stylesLabelless from "./index134.mjs";
import { AnimatePresence, motion } from "framer-motion";
import { LabelPairedCircleCaptionBoldIcon, LabelPairedCircleXmarkCaptionBoldIcon, LabelPairedCircleCheckCaptionBoldIcon, LabelPairedTriangleExclamationSmBoldIcon, LabelPairedCircleCheckSmBoldIcon } from "@deriv/quill-icons";
import { hasInputValue } from "./index109.mjs";
const textFieldStyles = {
  labelled: stylesLabelled,
  labelless: stylesLabelless
};
const TextFieldAtom = forwardRef(
  ({
    id,
    name,
    className = "",
    indicator = "neutral",
    state = "default",
    type = "outline",
    inputType = "text",
    inputElement = "input",
    showCharacterCounter = false,
    isGroup = false,
    isLeftGroup = false,
    label = "",
    iconLeft,
    iconLeftSecondary,
    iconRight,
    iconStatus,
    iconExtra,
    labelLeft = "",
    labelLeftValue = "",
    labelRight = "",
    isRequired = false,
    optionalText = "",
    maxLength = 32,
    message = "",
    messages = [],
    placeholder = "Placeholder",
    variant = "labelled",
    textAlignment = "left",
    size = "md",
    showStatusIcon = true,
    value: inputValue,
    allowTyping = true,
    containerRef,
    customContent,
    customInnerContent,
    contentRight,
    onChange,
    onClick,
    onAddonLeftClick,
    onFocus,
    onBlur,
    onBeforeChange
  }, ref) => {
    const styles = textFieldStyles[variant];
    const MESSAGE_STATUS_STYLES = {
      neutral: styles.checklist1,
      success: styles.checklist2,
      fail: styles.checklist3
    };
    const STATUS_ICONS = {
      success: /* @__PURE__ */ jsx(LabelPairedCircleCheckSmBoldIcon, {}),
      fail: /* @__PURE__ */ jsx(LabelPairedTriangleExclamationSmBoldIcon, {}),
      neutral: null
    };
    const MESSAGE_ICONS = {
      success: /* @__PURE__ */ jsx(LabelPairedCircleCheckCaptionBoldIcon, {}),
      fail: /* @__PURE__ */ jsx(LabelPairedCircleXmarkCaptionBoldIcon, {}),
      neutral: /* @__PURE__ */ jsx(LabelPairedCircleCaptionBoldIcon, {})
    };
    const textFieldId = `quill-atom-textfield-${variant}-${indicator}-${state}-${type}-${size}-${textAlignment}-${isGroup ? "group" : ""}`;
    const [isFocused, setIsFocused] = useState(hasInputValue(inputValue));
    const [value, setValue] = useState(inputValue || "");
    const statusIcon = iconStatus ? iconStatus : STATUS_ICONS[indicator];
    const internalRef = inputElement === "input" ? useRef(null) : useRef(null);
    const inputRef = ref || internalRef;
    useEffect(() => {
      if (isFocused) {
        if (typeof inputRef === "object" && (inputRef == null ? void 0 : inputRef.current)) {
          inputRef.current.focus();
        }
      }
    }, [isFocused, inputRef]);
    const handleFocus = (e) => {
      if (state === "disabled") return;
      setIsFocused(true);
      onFocus == null ? void 0 : onFocus();
    };
    const handleChange = (e) => {
      if (!allowTyping) return;
      const newValue = e.target.value;
      if (newValue.length <= maxLength) {
        setValue(newValue);
        onChange == null ? void 0 : onChange(newValue);
      }
    };
    const handleBlur = () => {
      if (!hasInputValue(value)) {
        setIsFocused(false);
        onBlur == null ? void 0 : onBlur();
      }
    };
    const handleKeyInput = (e) => {
      if (typeof onBeforeChange === "function" && !(onBeforeChange == null ? void 0 : onBeforeChange.isAction)) {
        if (!onBeforeChange(e.key)) {
          e.preventDefault();
        }
      }
    };
    const inputProps = {
      id: id || textFieldId,
      name,
      className: `${styles.input} quill-ui-next-input ${!allowTyping && "quill-ui-next-no-typing"}`,
      value,
      onChange: handleChange,
      placeholder,
      type: inputType,
      onFocus: () => setIsFocused(true),
      onBlur: handleBlur,
      disabled: state === "disabled",
      readOnly: !allowTyping,
      onKeyDown: handleKeyInput,
      onKeyUp: handleKeyInput,
      onKeyPress: handleKeyInput
    };
    useEffect(() => {
      if (inputValue !== void 0) {
        setValue(inputValue);
      }
    }, [inputValue]);
    const isLabelActive = isFocused || hasInputValue(value);
    const renderInputContents = () => {
      const contents = /* @__PURE__ */ jsxs(Fragment, { children: [
        variant === "labelled" ? /* @__PURE__ */ jsxs(
          "div",
          {
            className: `${styles.labelmarkerinput} textfield-label-marker`,
            style: { overflow: isLabelActive ? "visible" : "hidden" },
            children: [
              /* @__PURE__ */ jsxs("div", { className: styles.labelMarker, children: [
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: `${styles.label} quill-ui-next-input-label-transition`,
                    children: label
                  }
                ),
                (isRequired || optionalText) && /* @__PURE__ */ jsxs(Fragment, { children: [
                  isRequired && /* @__PURE__ */ jsx("div", { className: styles.fieldMarkerRequired, children: /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: `${styles.label1} quill-ui-next-input-label-transition`,
                      children: "*"
                    }
                  ) }),
                  optionalText && !isRequired && /* @__PURE__ */ jsx("div", { className: styles.fieldMarkerOptional, children: /* @__PURE__ */ jsx(
                    "div",
                    {
                      className: `${styles.label2} quill-ui-next-input-label-transition`,
                      children: optionalText
                    }
                  ) })
                ] })
              ] }),
              /* @__PURE__ */ jsx(AnimatePresence, { initial: false, children: inputElement === "input" ? /* @__PURE__ */ jsx(
                motion.input,
                {
                  ...inputProps,
                  ref: inputRef,
                  initial: false,
                  animate: {
                    y: isLabelActive ? 0 : "100%",
                    opacity: isLabelActive ? 1 : 0,
                    scale: isLabelActive ? 1 : 0.95
                  },
                  transition: {
                    duration: 0.2,
                    ease: "easeOut"
                  },
                  style: {
                    originY: 0,
                    position: "relative",
                    display: "block",
                    width: "100%",
                    pointerEvents: isLabelActive ? "auto" : "none",
                    marginTop: isLabelActive ? "" : "-25px",
                    transition: "margin-top 0.2s ease-out",
                    marginLeft: "-2px"
                  }
                }
              ) : /* @__PURE__ */ jsx(
                motion.textarea,
                {
                  ...inputProps,
                  ref: inputRef,
                  initial: false,
                  animate: {
                    y: isLabelActive ? 0 : "100%",
                    opacity: isLabelActive ? 1 : 0,
                    scale: isLabelActive ? 1 : 0.95
                  },
                  transition: {
                    duration: 0.2,
                    ease: "easeOut"
                  },
                  style: {
                    originY: 0,
                    position: "relative",
                    display: "block",
                    width: "100%",
                    pointerEvents: isLabelActive ? "auto" : "none",
                    transition: "margin-top 0.2s ease-out",
                    marginLeft: "-2px"
                  }
                }
              ) })
            ]
          }
        ) : inputElement === "input" ? /* @__PURE__ */ jsx(
          "input",
          {
            ref: inputRef,
            ...inputProps
          }
        ) : /* @__PURE__ */ jsx(
          "textarea",
          {
            ref: inputRef,
            ...inputProps
          }
        ),
        !isGroup && /* @__PURE__ */ jsx("div", { className: styles.labelRight, children: labelRight }),
        iconExtra && /* @__PURE__ */ jsx("div", { className: [styles.iconLeft, "textfield-icon"].join(" "), children: iconExtra }),
        showStatusIcon && statusIcon && !iconExtra && /* @__PURE__ */ jsx(
          "div",
          {
            className: [styles.iconLeft, "textfield-status-icon"].join(" "),
            children: statusIcon
          }
        ),
        iconRight && /* @__PURE__ */ jsx("div", { className: [styles.iconLeft, "textfield-icon"].join(" "), children: iconRight }),
        contentRight && contentRight
      ] });
      if (isGroup) {
        return /* @__PURE__ */ jsx("div", { className: styles.labelinputicon, children: contents });
      }
      return contents;
    };
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: [
          styles.root,
          className,
          "quill-ui-next-atom",
          "quill-ui-next-atom-textfield",
          "quill-ui-next-no-select"
        ].join(" "),
        "data-indicator": indicator,
        "data-is-typed": isFocused,
        "data-state": state,
        "data-type": type,
        "data-id": textFieldId,
        "data-variant": variant,
        "data-text-alignment": textAlignment,
        "data-size": size,
        "data-group": isGroup ? "true" : "false",
        "data-input-element": inputElement,
        onClick,
        children: [
          /* @__PURE__ */ jsxs(
            "div",
            {
              ref: containerRef,
              className: [
                styles.field,
                "quill-ui-next-no-focus",
                "quill-ui-next-textfield-field"
              ].join(" "),
              onFocus: handleFocus,
              onBlur: () => state !== "disabled" && handleBlur(),
              tabIndex: 0,
              children: [
                /* @__PURE__ */ jsxs("div", { className: `${styles.field} quill-ui-next-textfield-content`, children: [
                  !isGroup && !isLeftGroup && /* @__PURE__ */ jsxs(Fragment, { children: [
                    iconLeft && /* @__PURE__ */ jsx(
                      "div",
                      {
                        className: [styles.iconLeft, "textfield-icon"].join(" "),
                        children: iconLeft
                      }
                    ),
                    /* @__PURE__ */ jsx("div", { className: styles.labelLeft, children: labelLeft })
                  ] }),
                  isGroup && /* @__PURE__ */ jsx("div", { className: styles.addonLeft, children: /* @__PURE__ */ jsx("div", { className: styles.labelLeft, children: labelLeft }) }),
                  isLeftGroup && /* @__PURE__ */ jsxs("div", { className: "left-group-addon", onClick: onAddonLeftClick, children: [
                    /* @__PURE__ */ jsx("div", { className: [styles.iconLeft, "textfield-icon"].join(" "), children: iconLeft }),
                    /* @__PURE__ */ jsxs("div", { className: "left-group-addon-content", children: [
                      /* @__PURE__ */ jsx("div", { className: "left-group-addon-content-label", children: labelLeft }),
                      /* @__PURE__ */ jsx("div", { className: "left-group-addon-content-value", children: labelLeftValue })
                    ] }),
                    iconLeftSecondary && /* @__PURE__ */ jsx(
                      "div",
                      {
                        className: [styles.iconLeft, "textfield-icon"].join(" "),
                        children: iconLeftSecondary
                      }
                    )
                  ] }),
                  renderInputContents(),
                  isGroup && /* @__PURE__ */ jsx("div", { className: styles.addonRight, children: /* @__PURE__ */ jsx("div", { className: styles.labelRight, children: labelRight }) })
                ] }),
                customInnerContent && customInnerContent
              ]
            }
          ),
          /* @__PURE__ */ jsx("div", { className: styles.message + " quill-ui-next-hidden" }),
          (message || showCharacterCounter) && /* @__PURE__ */ jsxs("div", { className: styles.messageCharacterCounter, children: [
            message && /* @__PURE__ */ jsx("div", { className: styles.message, children: message }),
            showCharacterCounter && /* @__PURE__ */ jsxs("div", { className: styles.characterCounter, children: [
              typeof value === "string" ? value.length : value == null ? void 0 : value.toString().length,
              "/",
              maxLength
            ] })
          ] }),
          messages && /* @__PURE__ */ jsx("div", { className: styles.passwordStrength, children: messages.map(({ icon, type: type2, text }, index) => {
            const statusType = MESSAGE_STATUS_STYLES[type2];
            return /* @__PURE__ */ jsxs(
              "div",
              {
                className: `${statusType} textfield-message-${type2}`,
                children: [
                  icon ? icon : MESSAGE_ICONS[type2],
                  /* @__PURE__ */ jsx("div", { className: styles.message1, children: text })
                ]
              },
              index
            );
          }) }),
          customContent && customContent
        ]
      }
    );
  }
);
export {
  TextFieldAtom as default
};
//# sourceMappingURL=index94.mjs.map
