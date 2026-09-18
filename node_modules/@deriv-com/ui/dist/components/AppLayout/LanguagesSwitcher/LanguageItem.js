import { jsx as e } from "react/jsx-runtime";
import { Button as i } from "../../Button/index.js";
import { Text as r } from "../../Text/index.js";
import { c as s } from "../../../clsx-OuTLNxxd.js";
const n = ({
  language: o,
  onButtonClick: m,
  selectedLanguage: a
}) => {
  const t = a === o.code;
  return /* @__PURE__ */ e(
    i,
    {
      className: s("languages-modal__body-button", {
        "languages-modal__body-button-selected": t
      }),
      icon: o.icon,
      onClick: m,
      variant: "ghost",
      color: "white",
      children: /* @__PURE__ */ e(r, { size: "sm", weight: t ? "bold" : "normal", children: o.displayName })
    }
  );
};
n.displayName = "LanguageItem";
export {
  n as LanguageItem
};
