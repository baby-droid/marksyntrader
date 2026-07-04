import '../../assets/PageLayout.css';
import { jsxs as i, jsx as a } from "react/jsx-runtime";
import { useDevice as t } from "../../hooks/useDevice.js";
/* empty css                        */
const m = ({
  children: e,
  sidebar: s
}) => {
  const { isMobile: o } = t();
  return /* @__PURE__ */ i("div", { className: "derivs-page-layout", children: [
    s && !o && /* @__PURE__ */ a("div", { className: "derivs-page-layout__sidebar", children: s }),
    e && /* @__PURE__ */ a("div", { className: "derivs-page-layout__content", children: e })
  ] });
};
export {
  m as PageLayout
};
