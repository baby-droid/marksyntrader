import { jsxs as n, jsx as p } from "react/jsx-runtime";
import { useCallback as _ } from "react";
import { c as f } from "../../clsx-OuTLNxxd.js";
import { Text as u } from "../Text/index.js";
const j = ({
  icon: o,
  activeTab: c,
  isActive: s,
  setSelectedTab: t,
  title: a,
  className: m,
  variant: i,
  onChange: r,
  TitleFontSize: l
}) => {
  const e = _(
    (d) => {
      t(d), r == null || r();
    },
    [t, c]
  ), b = {
    primary: "derivs-primary-tabs__btn--active",
    secondary: "derivs-secondary-tabs__btn--active"
  };
  return /* @__PURE__ */ n(
    "button",
    {
      className: f(
        `derivs-${i + "-"}tabs__btn`,
        {
          [b[i]]: s
        },
        m
      ),
      type: "button",
      onClick: () => e(a),
      children: [
        o,
        /* @__PURE__ */ p(u, { weight: s ? "bold" : "normal", size: l, children: a })
      ]
    }
  );
};
export {
  j as default
};
