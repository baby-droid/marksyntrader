"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const Steppers_module = require("./index66.cjs");
const index$1 = require("./index67.cjs");
const index = require("./index68.cjs");
const index$2 = require("./index69.cjs");
const Steppers = ({
  className = "",
  direction = "horizontal",
  steps = [],
  marker = "dot",
  size = "sm",
  onClick
}) => {
  const handleClick = (step) => {
    if (onClick) {
      onClick(step);
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      className: [Steppers_module.default.root, className, "quill-ui-next-component"].join(" "),
      "data-direction": direction,
      "data-size": size,
      children: steps.map((step, index$3) => {
        const isLastStep = index$3 === steps.length - 1;
        const isFirstStep = index$3 === 0;
        const nextStep = steps[index$3 + 1];
        const nextStepType = nextStep == null ? void 0 : nextStep.type;
        let trackType = step.type === "complete" ? "inprogress" : step.type;
        let track1 = trackType;
        let track2 = trackType;
        if (isFirstStep) {
          track1 = void 0;
        }
        if (isLastStep) {
          track2 = void 0;
        }
        return /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            className: Steppers_module.default.stepper_container,
            onClick: () => handleClick(step),
            children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: Steppers_module.default.header, children: [
                /* @__PURE__ */ jsxRuntime.jsx(
                  index,
                  {
                    className: Steppers_module.default.track,
                    type: track1 === void 0 ? "hidden" : track1,
                    direction
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  index$1,
                  {
                    marker,
                    indicator: step.indicator,
                    size,
                    text: index$3 + 1,
                    type: step.type,
                    icon: step == null ? void 0 : step.icon
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  index,
                  {
                    type: track2 === void 0 ? "hidden" : nextStepType === "inactive" ? "inactive" : track2,
                    direction
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx(
                index$2,
                {
                  label: step == null ? void 0 : step.label,
                  description: step == null ? void 0 : step.description,
                  direction,
                  type: step.type === "inactive" ? "incomplete" : step.type
                }
              )
            ]
          },
          `stepper-${index$3}`
        );
      })
    }
  );
};
Steppers.displayName = "Steppers";
exports.Steppers = Steppers;
exports.default = Steppers;
//# sourceMappingURL=index5.cjs.map
