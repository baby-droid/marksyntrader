"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index74.cjs");
const Pagination_module = require("./index75.cjs");
const quillIcons = require("@deriv/quill-icons");
const Pagination = ({
  data,
  itemsPerPage = 10,
  currentPage,
  defaultPage = 1,
  onPageChange,
  variant = "number",
  renderItem,
  className = "",
  itemsClassName = ""
}) => {
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const isControlled = currentPage !== void 0;
  const [internalPage, setInternalPage] = React.useState(defaultPage);
  const page = isControlled ? currentPage : internalPage;
  const handlePageChange = (newPage) => {
    if (!isControlled) setInternalPage(newPage);
    onPageChange == null ? void 0 : onPageChange(newPage);
  };
  const startIdx = (page - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pageData = data.slice(startIdx, endIdx);
  const getPageButtons = () => {
    if (variant === "bullet" || totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    if (page <= 3) {
      pages.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (page >= totalPages - 2) {
      pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
    }
    return pages;
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: [Pagination_module.default.root, className, "quill-ui-next-component"].filter(Boolean).join(" "),
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: [Pagination_module.default.items, itemsClassName].filter(Boolean).join(" "), children: pageData.map((item, idx) => renderItem(item, startIdx + idx)) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: Pagination_module.default.controls, children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            index,
            {
              variant: "button",
              icon: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronLeftSmRegularIcon, {}),
              state: page === 1 ? "disabled" : "default",
              onClick: page > 1 ? () => handlePageChange(page - 1) : void 0
            }
          ),
          getPageButtons().map((btn, idx) => {
            if (btn === "...") {
              if (variant !== "number") return null;
              return /* @__PURE__ */ jsxRuntime.jsx(
                index,
                {
                  variant: "page",
                  label: "...",
                  state: "disabled",
                  onClick: void 0
                },
                `ellipsis-${idx}`
              );
            }
            const pageNum = btn;
            return /* @__PURE__ */ jsxRuntime.jsx(
              index,
              {
                variant: variant === "number" ? "page" : variant,
                label: variant === "number" ? String(pageNum) : void 0,
                state: page === pageNum ? "selected" : "default",
                onClick: page !== pageNum ? () => handlePageChange(pageNum) : void 0
              },
              pageNum
            );
          }),
          /* @__PURE__ */ jsxRuntime.jsx(
            index,
            {
              variant: "button",
              icon: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronRightSmRegularIcon, {}),
              state: page === totalPages ? "disabled" : "default",
              onClick: page < totalPages ? () => handlePageChange(page + 1) : void 0
            }
          )
        ] })
      ]
    }
  );
};
Pagination.displayName = "Pagination";
exports.Pagination = Pagination;
exports.default = Pagination;
//# sourceMappingURL=index9.cjs.map
