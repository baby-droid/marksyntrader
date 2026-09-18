import { jsxs, jsx } from "react/jsx-runtime";
import { useState } from "react";
import PaginationAtom from "./index74.mjs";
import styles from "./index75.mjs";
import { LabelPairedChevronLeftSmRegularIcon, LabelPairedChevronRightSmRegularIcon } from "@deriv/quill-icons";
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
  const [internalPage, setInternalPage] = useState(defaultPage);
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
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: [styles.root, className, "quill-ui-next-component"].filter(Boolean).join(" "),
      children: [
        /* @__PURE__ */ jsx("div", { className: [styles.items, itemsClassName].filter(Boolean).join(" "), children: pageData.map((item, idx) => renderItem(item, startIdx + idx)) }),
        /* @__PURE__ */ jsxs("div", { className: styles.controls, children: [
          /* @__PURE__ */ jsx(
            PaginationAtom,
            {
              variant: "button",
              icon: /* @__PURE__ */ jsx(LabelPairedChevronLeftSmRegularIcon, {}),
              state: page === 1 ? "disabled" : "default",
              onClick: page > 1 ? () => handlePageChange(page - 1) : void 0
            }
          ),
          getPageButtons().map((btn, idx) => {
            if (btn === "...") {
              if (variant !== "number") return null;
              return /* @__PURE__ */ jsx(
                PaginationAtom,
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
            return /* @__PURE__ */ jsx(
              PaginationAtom,
              {
                variant: variant === "number" ? "page" : variant,
                label: variant === "number" ? String(pageNum) : void 0,
                state: page === pageNum ? "selected" : "default",
                onClick: page !== pageNum ? () => handlePageChange(pageNum) : void 0
              },
              pageNum
            );
          }),
          /* @__PURE__ */ jsx(
            PaginationAtom,
            {
              variant: "button",
              icon: /* @__PURE__ */ jsx(LabelPairedChevronRightSmRegularIcon, {}),
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
export {
  Pagination,
  Pagination as default
};
//# sourceMappingURL=index9.mjs.map
