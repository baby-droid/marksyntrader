import '../../../../assets/index17.css';
import { jsxs as t, jsx as e } from "react/jsx-runtime";
import { c } from "../../../../clsx-OuTLNxxd.js";
import { Button as d } from "../../../Button/index.js";
const v = ({
  account: i,
  onSelectAccount: s,
  onResetBalance: r
}) => /* @__PURE__ */ t(
  "div",
  {
    className: c("deriv-account-switcher-item", {
      "deriv-account-switcher-item--active": i.isActive
    }),
    onClick: s,
    children: [
      /* @__PURE__ */ e("div", { className: "deriv-account-switcher-item__icon", children: i.icon }),
      /* @__PURE__ */ t("div", { className: "deriv-account-switcher-item__detail", children: [
        /* @__PURE__ */ e(
          "div",
          {
            className: c("deriv-account-switcher-item__currency", {
              "deriv-account-switcher-item__currency--active": i.isActive
            }),
            children: i.currencyLabel
          }
        ),
        /* @__PURE__ */ e(
          "div",
          {
            className: c("deriv-account-switcher-item__loginid", {
              "deriv-account-switcher-item__loginid--active": i.isActive
            }),
            children: i.loginid
          }
        )
      ] }),
      /* @__PURE__ */ e(
        "div",
        {
          className: c("deriv-account-switcher-item__balance", {
            "deriv-account-switcher-item__balance--active": i.isActive
          }),
          children: r ? /* @__PURE__ */ e(
            d,
            {
              borderWidth: "sm",
              textSize: "xs",
              size: "xs",
              variant: "outlined",
              color: "black",
              isFullWidth: !0,
              onClick: r,
              children: "Reset balance"
            }
          ) : `${i.balance} ${i.currency}`
        }
      )
    ]
  },
  i.loginid
);
export {
  v as AccountsItem
};
