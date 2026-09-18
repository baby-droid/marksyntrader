import { jsxs, jsx } from "react/jsx-runtime";
import styles from "./index115.mjs";
import { LabelPairedLoaderMdRegularIcon } from "@deriv/quill-icons";
const PurchaseButton = ({
  className = "",
  state = "default",
  type = "buy",
  label = "Payout",
  title = "Title",
  value = "Value",
  showContent = true,
  onClick
}) => {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [
        styles.root,
        className,
        state === "default" ? "quill-ui-next-pointer" : ""
      ].join(" "),
      "data-state": state,
      "data-type": type,
      role: "button",
      tabIndex: state === "loading" || state === "disabled" ? -1 : 0,
      onClick: (e) => state !== "loading" && state !== "disabled" && (onClick == null ? void 0 : onClick(e)),
      children: [
        state === "loading" && /* @__PURE__ */ jsx("div", { className: [styles.iconLoading, "quill-ui-next-spinner"].join(" "), children: /* @__PURE__ */ jsx("div", { className: styles.icon, children: /* @__PURE__ */ jsx(LabelPairedLoaderMdRegularIcon, { fill: "var(--component-button-label-color-buy-primary)" }) }) }),
        !!showContent && /* @__PURE__ */ jsxs("div", { className: styles.containerContent, children: [
          /* @__PURE__ */ jsx("div", { className: styles.title, children: /* @__PURE__ */ jsx("div", { className: styles.label, children: title }) }),
          /* @__PURE__ */ jsxs("div", { className: styles.description, children: [
            /* @__PURE__ */ jsx("div", { className: styles.details, children: label }),
            /* @__PURE__ */ jsx("div", { className: styles.value, children: value })
          ] })
        ] })
      ]
    }
  );
};
export {
  PurchaseButton,
  PurchaseButton as default
};
//# sourceMappingURL=index34.mjs.map
