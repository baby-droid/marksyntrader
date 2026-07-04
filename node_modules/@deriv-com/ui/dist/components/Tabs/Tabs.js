import '../../assets/Tabs.css';
import { jsxs as d, jsx as l } from "react/jsx-runtime";
import { useState as u, useEffect as b } from "react";
import x from "./TabTitle.js";
import { c as N } from "../../clsx-OuTLNxxd.js";
/* empty css                  */
const y = ({
  children: r,
  activeTab: t,
  wrapperClassName: c,
  className: m,
  variant: p = "primary",
  onChange: e,
  TitleFontSize: a
}) => {
  const [o, i] = u(
    t || r[0].props.title
  );
  return b(() => {
    t && i(t);
  }, [t]), /* @__PURE__ */ d("div", { className: c, children: [
    /* @__PURE__ */ l("div", { className: N(`derivs-${p + "-"}tabs`, m), children: r.map((s, f) => /* @__PURE__ */ l(
      x,
      {
        icon: s.props.icon,
        activeTab: o,
        isActive: s.props.title === o,
        setSelectedTab: i,
        title: s.props.title,
        variant: p,
        onChange: () => e == null ? void 0 : e(f),
        className: s.props.className,
        TitleFontSize: a
      },
      `derivs-${p + "-"}tab-${s.props.title}`
    )) }),
    r.find((s) => s.props.title === o)
  ] });
};
export {
  y as default
};
