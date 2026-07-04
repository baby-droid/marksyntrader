import { jsx } from "react/jsx-runtime";
import BaseCard from "./index112.mjs";
import CardVerticalLayout from "./index113.mjs";
const CardBasicVertical = (props) => {
  return /* @__PURE__ */ jsx(
    BaseCard,
    {
      ...props,
      layout: "vertical",
      renderLayout: (renderProps) => /* @__PURE__ */ jsx(CardVerticalLayout, { ...renderProps })
    }
  );
};
export {
  CardBasicVertical,
  CardBasicVertical as default
};
//# sourceMappingURL=index32.mjs.map
