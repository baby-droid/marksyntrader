import { jsx } from "react/jsx-runtime";
import styles from "./index127.mjs";
const SteppersTrackAtom = ({
  className = "",
  type = "inactive",
  direction = "horizontal"
}) => {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: [styles.root, className].join(" "),
      "data-type": type,
      "data-direction": direction
    }
  );
};
export {
  SteppersTrackAtom as default
};
//# sourceMappingURL=index68.mjs.map
