import '../../../assets/MobileLanguagesDrawer.css';
import { jsx as r } from "react/jsx-runtime";
import { c as i } from "../../../clsx-OuTLNxxd.js";
import { LanguageItem as m } from "./LanguageItem.js";
const l = ({
  languages: e,
  onClose: t,
  onLanguageSwitch: a,
  selectedLanguage: n,
  isOpen: s,
  wrapperClassName: c
}) => /* @__PURE__ */ r("div", { className: i("languages__body", c), children: s && e.map((o) => /* @__PURE__ */ r(
  m,
  {
    language: o,
    onButtonClick: () => {
      a(o.code), t();
    },
    selectedLanguage: n
  },
  o.code
)) });
l.displayName = "MobileLanguagesDrawer";
export {
  l as MobileLanguagesDrawer
};
