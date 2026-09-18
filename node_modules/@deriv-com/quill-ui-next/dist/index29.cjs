"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index94.cjs");
const quillIcons = require("@deriv/quill-icons");
const useClickOutside = require("./index47.cjs");
const index$1 = require("./index111.cjs");
;/* empty css          */
;/* empty css          */
const Calendar = require("react-calendar");
const dateFns = require("date-fns");
const client = require("./index98.cjs");
const index$2 = require("./index35.cjs");
const Datepicker = ({
  dateFormat = "dd/mm/yyyy",
  size = "md",
  minDate,
  maxDate,
  ...props
}) => {
  const [value, setValue] = React.useState(props.value);
  const [isOpen, setIsOpen] = React.useState(false);
  const datepickerRef = React.useRef(null);
  const prevFormatRef = React.useRef(dateFormat);
  const datepickerContainerOffets = {
    sm: 15,
    md: 20,
    lg: 35
  };
  const mapFormatString = (dateFormat2) => {
    return dateFormat2.replace(/yyyy/g, "yyyy").replace(/yy/g, "yy").replace(/mm/g, "MM").replace(/dd/g, "dd");
  };
  const parseToDate = (date) => {
    if (!date) return void 0;
    if (date instanceof Date) return date;
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? void 0 : parsed;
  };
  const getValidDate = (value2, dateFormat2) => {
    if (!value2) return null;
    if (typeof value2 === "string") {
      const formatString = mapFormatString(dateFormat2);
      const parsed = dateFns.parse(value2, formatString, /* @__PURE__ */ new Date());
      return !isNaN(parsed.getTime()) ? parsed : null;
    }
    if (typeof value2 === "number") {
      const date = new Date(value2);
      return !isNaN(date.getTime()) ? date : null;
    }
    return null;
  };
  const handleClick = (e) => {
    if (props.state === "disabled") return;
    if (!e.target.closest(".quill-ui-next-calendar")) {
      setIsOpen(!isOpen);
    }
  };
  const handleChange = (date) => {
    var _a, _b;
    const formatString = mapFormatString(dateFormat);
    const formattedDate = dateFns.format(date, formatString);
    (_a = datepickerRef.current) == null ? void 0 : _a.focus();
    setValue(formattedDate);
    (_b = props.onChange) == null ? void 0 : _b.call(props, formattedDate);
    setTimeout(() => {
      setIsOpen(false);
    }, 100);
  };
  React.useEffect(() => {
    if (isOpen) {
      const calendar = document.querySelector(".quill-ui-next-calendar");
      const setNavIcon = (selector, icon) => {
        const nav = calendar == null ? void 0 : calendar.querySelector(selector);
        if (nav) {
          nav.innerHTML = "";
          const container = document.createElement("span");
          nav.appendChild(container);
          client.clientExports.createRoot(container).render(icon);
        }
      };
      setNavIcon(
        ".react-calendar__navigation__prev-button",
        /* @__PURE__ */ jsxRuntime.jsx(
          index$2.IconButton,
          {
            style: "tertiary",
            size: "sm",
            icon: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronLeftSmBoldIcon, {}),
            color: "blackWhite"
          }
        )
      );
      setNavIcon(
        ".react-calendar__navigation__next-button",
        /* @__PURE__ */ jsxRuntime.jsx(
          index$2.IconButton,
          {
            size: "sm",
            style: "tertiary",
            icon: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronRightSmBoldIcon, {}),
            color: "blackWhite"
          }
        )
      );
    }
  }, [isOpen]);
  React.useEffect(() => {
    var _a;
    if (value && prevFormatRef.current !== dateFormat) {
      const prevFormatString = mapFormatString(prevFormatRef.current);
      const date = dateFns.parse(value, prevFormatString, /* @__PURE__ */ new Date());
      if (!isNaN(date.getTime())) {
        const newFormatString = mapFormatString(dateFormat);
        const newValue = dateFns.format(date, newFormatString);
        setValue(newValue);
        (_a = props.onChange) == null ? void 0 : _a.call(props, newValue);
      }
      prevFormatRef.current = dateFormat;
    }
  }, [dateFormat]);
  useClickOutside.useClickOutside(
    datepickerRef,
    () => {
      setIsOpen(false);
    },
    ["quill-ui-next-calendar"]
  );
  return /* @__PURE__ */ jsxRuntime.jsx(
    index,
    {
      ref: datepickerRef,
      ...props,
      size,
      allowTyping: false,
      placeholder: dateFormat,
      iconLeft: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCalendarSmBoldIcon, {}),
      iconRight: /* @__PURE__ */ jsxRuntime.jsx(
        quillIcons.LabelPairedChevronDownSmBoldIcon,
        {
          className: `quill-ui-next-rotatable ${isOpen && "quill-ui-next-rotate"}`
        }
      ),
      onChange: (e) => {
        var _a;
        setValue(e);
        (_a = props.onChange) == null ? void 0 : _a.call(props, e);
      },
      onClick: handleClick,
      value,
      className: `${props.state !== "disabled" && "quill-ui-next-pointer"}`,
      customContent: /* @__PURE__ */ jsxRuntime.jsx(
        index$1.DropdownContainerAtom,
        {
          width: "fit-content",
          textAlignment: props.textAlignment,
          parent: datepickerRef,
          isOpen,
          offsetTop: props.variant === "labelless" ? datepickerContainerOffets[size] : 35,
          onActionSheetClose: () => setIsOpen(false),
          customContent: /* @__PURE__ */ jsxRuntime.jsx(
            Calendar,
            {
              value: getValidDate(value, dateFormat),
              onChange: (value2, event) => {
                if (value2 instanceof Date) handleChange(value2);
              },
              locale: "en-GB",
              showNeighboringMonth: false,
              className: "quill-ui-next-calendar",
              minDate: parseToDate(minDate),
              maxDate: parseToDate(maxDate)
            }
          )
        }
      )
    }
  );
};
exports.Datepicker = Datepicker;
exports.default = Datepicker;
//# sourceMappingURL=index29.cjs.map
