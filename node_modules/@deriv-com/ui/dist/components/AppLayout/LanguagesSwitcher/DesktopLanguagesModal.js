import '../../../assets/Table.css';
import '../../../assets/Tabs.css';
import '../../../assets/SideNote.css';
import '../../../assets/SectionMessage.css';
import '../../../assets/PasswordMeter.css';
import '../../../assets/PageLayout.css';
import '../../../assets/LinearProgressBar.css';
import '../../../assets/InlineMessage.css';
import '../../../assets/Dropdown.css';
import '../../../assets/CircularProgressBar.css';
import '../../../assets/Breadcrumbs.css';
import '../../../assets/ActionScreen.css';
import '../../../assets/DesktopLanguagesModal.css';
import { jsxs as d, jsx as o } from "react/jsx-runtime";
import "../../Accordion/index.js";
import "react";
import { Text as l } from "../../Text/index.js";
/* empty css                             */
import "../../Loader/index.js";
import "../../Button/index.js";
import "../../Badge/index.js";
/* empty css                            */
import "../../Checkbox/index.js";
/* empty css                                    */
import "../../Dialog/index.js";
import "../../Input/index.js";
/* empty css                         */
/* empty css                              */
/* empty css                                  */
import { Modal as i } from "../../Modal/index.js";
/* empty css                           */
import "../../../PasswordInput-53KGYo2D.js";
/* empty css                              */
/* empty css                               */
/* empty css                         */
/* empty css                     */
import "../../../hooks/useFetchMore.js";
/* empty css                      */
import "../../TextArea/index.js";
import "../../ToggleSwitch/index.js";
import "../../Tooltip/index.js";
import "../../VerticalTab/VerticalTab.js";
import "../../VerticalTab/VerticalTabItems.js";
import "../AccountSwitcher/index.js";
import "../DerivLogo/index.js";
import "../Drawer/index.js";
import "../Footer/index.js";
import "../Header/index.js";
import "../MenuItem/index.js";
import "../Wrapper/index.js";
import "../Notifications/index.js";
import "../PlatformSwitcher/index.js";
import "../PlatformSwitcher/PlatformSwitcherItem.js";
import "./MobileLanguagesDrawer.js";
import "../Submenu /index.js";
import "../../ContextMenu/index.js";
import { LanguageItem as n } from "./LanguageItem.js";
const c = ({
  isModalOpen: m,
  languages: p,
  onClose: t,
  onLanguageSwitch: e,
  selectedLanguage: a,
  headerTitle: s
}) => /* @__PURE__ */ d(
  i,
  {
    ariaHideApp: !1,
    className: "languages-modal",
    isOpen: m,
    onRequestClose: t,
    children: [
      /* @__PURE__ */ o(i.Header, { onRequestClose: t, children: /* @__PURE__ */ o(l, { weight: "bold", children: s }) }),
      /* @__PURE__ */ o(i.Body, { className: "languages-modal__body", children: p.map((r) => /* @__PURE__ */ o(
        n,
        {
          language: r,
          selectedLanguage: a,
          onButtonClick: () => {
            e(r.code), t();
          }
        },
        r.code
      )) })
    ]
  }
);
c.displayName = "DesktopLanguagesModal";
export {
  c as DesktopLanguagesModal
};
