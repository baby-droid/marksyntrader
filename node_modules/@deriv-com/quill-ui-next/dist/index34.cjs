"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const PurchaseButton_module = require("./index115.cjs");
const quillIcons = require("@deriv/quill-icons");
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
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [
        PurchaseButton_module.default.root,
        className,
        state === "default" ? "quill-ui-next-pointer" : ""
      ].join(" "),
      "data-state": state,
      "data-type": type,
      role: "button",
      tabIndex: state === "loading" || state === "disabled" ? -1 : 0,
      onClick: (e) => state !== "loading" && state !== "disabled" && (onClick == null ? void 0 : onClick(e)),
      children: [
        state === "loading" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: [PurchaseButton_module.default.iconLoading, "quill-ui-next-spinner"].join(" "), children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: PurchaseButton_module.default.icon, children: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedLoaderMdRegularIcon, { fill: "var(--component-button-label-color-buy-primary)" }) }) }),
        !!showContent && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: PurchaseButton_module.default.containerContent, children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: PurchaseButton_module.default.title, children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: PurchaseButton_module.default.label, children: title }) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: PurchaseButton_module.default.description, children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: PurchaseButton_module.default.details, children: label }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: PurchaseButton_module.default.value, children: value })
          ] })
        ] })
      ]
    }
  );
};
exports.PurchaseButton = PurchaseButton;
exports.default = PurchaseButton;
//# sourceMappingURL=index34.cjs.map
