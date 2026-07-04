import { jsx } from "react/jsx-runtime";
import BaseCard from "./index112.mjs";
import CardHorizontalLayout from "./index114.mjs";
const CardBasicHorizontal = (props) => {
  return /* @__PURE__ */ jsx(
    BaseCard,
    {
      ...props,
      layout: "horizontal",
      renderLayout: (renderProps) => /* @__PURE__ */ jsx(CardHorizontalLayout, { ...renderProps })
    }
  );
};
export {
  CardBasicHorizontal,
  CardBasicHorizontal as default
};
//# sourceMappingURL=index33.mjs.map
