import { jsx, jsxs } from "react/jsx-runtime";
import styles from "./index66.mjs";
import SteppersMarkerAtom from "./index67.mjs";
import SteppersTrackAtom from "./index68.mjs";
import SteppersLabelContentAtom from "./index69.mjs";
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
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: [styles.root, className, "quill-ui-next-component"].join(" "),
      "data-direction": direction,
      "data-size": size,
      children: steps.map((step, index) => {
        const isLastStep = index === steps.length - 1;
        const isFirstStep = index === 0;
        const nextStep = steps[index + 1];
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
        return /* @__PURE__ */ jsxs(
          "div",
          {
            className: styles.stepper_container,
            onClick: () => handleClick(step),
            children: [
              /* @__PURE__ */ jsxs("div", { className: styles.header, children: [
                /* @__PURE__ */ jsx(
                  SteppersTrackAtom,
                  {
                    className: styles.track,
                    type: track1 === void 0 ? "hidden" : track1,
                    direction
                  }
                ),
                /* @__PURE__ */ jsx(
                  SteppersMarkerAtom,
                  {
                    marker,
                    indicator: step.indicator,
                    size,
                    text: index + 1,
                    type: step.type,
                    icon: step == null ? void 0 : step.icon
                  }
                ),
                /* @__PURE__ */ jsx(
                  SteppersTrackAtom,
                  {
                    type: track2 === void 0 ? "hidden" : nextStepType === "inactive" ? "inactive" : track2,
                    direction
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(
                SteppersLabelContentAtom,
                {
                  label: step == null ? void 0 : step.label,
                  description: step == null ? void 0 : step.description,
                  direction,
                  type: step.type === "inactive" ? "incomplete" : step.type
                }
              )
            ]
          },
          `stepper-${index}`
        );
      })
    }
  );
};
Steppers.displayName = "Steppers";
export {
  Steppers,
  Steppers as default
};
//# sourceMappingURL=index5.mjs.map
