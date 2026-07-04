"use strict";
const jsxRuntime = require("react/jsx-runtime");
const SteppersTrack_module = require("./index127.cjs");
const SteppersTrackAtom = ({
  className = "",
  type = "inactive",
  direction = "horizontal"
}) => {
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      className: [SteppersTrack_module.default.root, className].join(" "),
      "data-type": type,
      "data-direction": direction
    }
  );
};
module.exports = SteppersTrackAtom;
//# sourceMappingURL=index68.cjs.map
