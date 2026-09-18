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
const index$3 = require("./index36.cjs");
const useDevice = require("./index51.cjs");
const DateRangePicker = ({
  dateFormat = "dd/mm/yyyy",
  size = "md",
  minDate,
  maxDate,
  value: propValue,
  onChange,
  inputStartDate,
  inputEndDate,
  actionSheet,
  ...props
}) => {
  var _a;
  const [range, setRange] = React.useState([null, null]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [startActiveMonth, setStartActiveMonth] = React.useState(null);
  const [endActiveMonth, setEndActiveMonth] = React.useState(null);
  const [activeInput, setActiveInput] = React.useState("start");
  const lastActiveInputRef = React.useRef(activeInput);
  const endInputRef = React.useRef(null);
  const startInputRef = React.useRef(null);
  const { isMobile } = useDevice.useDevice();
  React.useEffect(() => {
    if (propValue && Array.isArray(propValue)) {
      const parseToDate2 = (date) => {
        if (!date) return null;
        if (typeof date === "number") {
          const d = new Date(date);
          return isNaN(d.getTime()) ? null : d;
        }
        if (typeof date === "string") {
          const formatString = mapFormatString(dateFormat);
          const parsed = dateFns.parse(date, formatString, /* @__PURE__ */ new Date());
          return !isNaN(parsed.getTime()) ? parsed : null;
        }
        return null;
      };
      setRange([parseToDate2(propValue[0]), parseToDate2(propValue[1])]);
    }
  }, [propValue, dateFormat]);
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
  const handleInputClick = (input) => {
    setActiveInput(input);
    setIsOpen(true);
  };
  const handleMonthNavigation = (direction) => {
    var _a2, _b;
    lastActiveInputRef.current = activeInput;
    if (startActiveMonth && endActiveMonth) {
      const newStart = new Date(startActiveMonth);
      newStart.setMonth(newStart.getMonth() + 2 * direction);
      const newEnd = new Date(endActiveMonth);
      newEnd.setMonth(newEnd.getMonth() + 2 * direction);
      setStartActiveMonth(newStart);
      setEndActiveMonth(newEnd);
      const inputToFocus = lastActiveInputRef.current;
      setTimeout(() => {
        setActiveInput(inputToFocus);
      }, 100);
      if (lastActiveInputRef.current === "end") {
        (_a2 = endInputRef.current) == null ? void 0 : _a2.focus();
      } else {
        (_b = startInputRef.current) == null ? void 0 : _b.focus();
      }
    }
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
  useClickOutside.useClickOutside(
    startInputRef,
    () => {
      setIsOpen(false);
    },
    ["quill-ui-next-calendar-daterange-container", "clear-btn"]
  );
  const displayValue = range[0] && range[1] ? `${dateFns.format(range[0], mapFormatString(dateFormat))} - ${dateFns.format(
    range[1],
    mapFormatString(dateFormat)
  )}` : "";
  React.useEffect(() => {
    if (isOpen) {
      if (!startActiveMonth) {
        const start = range[0] || /* @__PURE__ */ new Date();
        setStartActiveMonth(new Date(start.getFullYear(), start.getMonth(), 1));
      }
      if (!endActiveMonth) {
        const start = range[0] || /* @__PURE__ */ new Date();
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        setEndActiveMonth(end);
      }
    }
  }, [isOpen]);
  const isInRange = (date) => {
    if (range[0] && range[1] && !isSameDay(range[0], range[1])) {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const start = new Date(
        range[0].getFullYear(),
        range[0].getMonth(),
        range[0].getDate()
      );
      const end = new Date(
        range[1].getFullYear(),
        range[1].getMonth(),
        range[1].getDate()
      );
      return d > start && d < end;
    }
    return false;
  };
  const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const getRangeTileClassName = (date, view) => {
    if (view !== "month") return void 0;
    if (range[0] && range[1] && isSameDay(range[0], range[1]) && isSameDay(date, range[0])) {
      return "quill-ui-next-calendar-range-single";
    }
    if (range[0] && isSameDay(date, range[0])) {
      return "quill-ui-next-calendar-range-start";
    }
    if (range[1] && isSameDay(date, range[1])) {
      return "quill-ui-next-calendar-range-end";
    }
    if (isInRange(date)) {
      return "quill-ui-next-calendar-in-range";
    }
    return void 0;
  };
  const handleCalendarChange = (value) => {
    var _a2, _b;
    let date = null;
    if (Array.isArray(value)) {
      date = value[0] instanceof Date ? value[0] : null;
    } else if (value instanceof Date) {
      date = value;
    }
    if (!date) return;
    if (activeInput === "start") {
      let nextEnd = range[1];
      if (range[1] && date > range[1]) {
        nextEnd = null;
      }
      setRange([date, nextEnd]);
      setActiveInput("end");
      (_a2 = startInputRef.current) == null ? void 0 : _a2.click();
      (_b = startInputRef.current) == null ? void 0 : _b.focus();
      setTimeout(() => {
        var _a3, _b2;
        (_a3 = endInputRef.current) == null ? void 0 : _a3.click();
        (_b2 = endInputRef.current) == null ? void 0 : _b2.focus();
      }, 100);
      return;
    }
    if (activeInput === "end") {
      if (!range[0]) {
        setRange([date, null]);
        setActiveInput("end");
        setTimeout(() => {
          var _a3;
          (_a3 = endInputRef.current) == null ? void 0 : _a3.focus();
        }, 0);
        return;
      }
      if (range[0] && !range[1]) {
        if (date < range[0]) {
          setRange([date, null]);
          setTimeout(() => {
            var _a3;
            setActiveInput("end");
            (_a3 = endInputRef.current) == null ? void 0 : _a3.focus();
          }, 0);
          return;
        }
        setRange([range[0], date]);
        const formatString2 = mapFormatString(dateFormat);
        const startStr2 = dateFns.format(range[0], formatString2);
        const endStr2 = dateFns.format(date, formatString2);
        onChange == null ? void 0 : onChange([startStr2, endStr2]);
        if (!isMobile) setTimeout(() => setIsOpen(false), 100);
        setTimeout(() => {
          var _a3;
          (_a3 = endInputRef.current) == null ? void 0 : _a3.focus();
        }, 0);
        return;
      }
      if (date < range[0]) {
        setRange([date, null]);
        setTimeout(() => {
          var _a3;
          setActiveInput("end");
          (_a3 = endInputRef.current) == null ? void 0 : _a3.focus();
        }, 0);
        return;
      }
      setRange([range[0], date]);
      const formatString = mapFormatString(dateFormat);
      const startStr = dateFns.format(range[0], formatString);
      const endStr = dateFns.format(date, formatString);
      onChange == null ? void 0 : onChange([startStr, endStr]);
      if (!isMobile) setTimeout(() => setIsOpen(false), 100);
      setTimeout(() => {
        var _a3;
        (_a3 = endInputRef.current) == null ? void 0 : _a3.focus();
      }, 0);
      return;
    }
  };
  const handleMobileCalendarChange = (value) => {
    if (Array.isArray(value) && value[0] instanceof Date && value[1] instanceof Date) {
      setRange([value[0], value[1]]);
      const formatString = mapFormatString(dateFormat);
      const startStr = dateFns.format(value[0], formatString);
      const endStr = dateFns.format(value[1], formatString);
      onChange == null ? void 0 : onChange([startStr, endStr]);
    } else if (value instanceof Date) {
      setRange([value, null]);
    } else if (!value) {
      setRange([null, null]);
    }
  };
  const renderDateRangePicker = () => {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "quill-ui-next-calendar-daterange-container", children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        index$2.IconButton,
        {
          className: "quill-ui-next-calendar-daterange-prev-button quill-ui-next-calendar-daterange-button",
          style: "tertiary",
          size: "sm",
          icon: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronLeftSmBoldIcon, {}),
          color: "blackWhite",
          onClick: () => handleMonthNavigation(-1)
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "quill-ui-next-daterange-picker-calendar-box", children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          Calendar,
          {
            value: range[0],
            onChange: (value) => handleCalendarChange(value),
            locale: "en-GB",
            showNeighboringMonth: false,
            className: "quill-ui-next-calendar",
            minDate: parseToDate(minDate),
            maxDate: parseToDate(maxDate),
            onActiveStartDateChange: ({ activeStartDate }) => {
              setStartActiveMonth(activeStartDate);
              if (endActiveMonth && activeStartDate && endActiveMonth.getFullYear() === activeStartDate.getFullYear() && endActiveMonth.getMonth() === activeStartDate.getMonth()) {
                const nextMonth = new Date(activeStartDate);
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                setEndActiveMonth(nextMonth);
              }
            },
            activeStartDate: startActiveMonth || void 0,
            navigationLabel: void 0,
            prevLabel: null,
            nextLabel: null,
            minDetail: "month",
            maxDetail: "month",
            tileClassName: ({ date, view }) => getRangeTileClassName(date, view)
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          Calendar,
          {
            value: range[1],
            onChange: handleCalendarChange,
            locale: "en-GB",
            showNeighboringMonth: false,
            className: "quill-ui-next-calendar",
            minDate: parseToDate(minDate),
            maxDate: parseToDate(maxDate),
            activeStartDate: endActiveMonth || void 0,
            navigationLabel: void 0,
            prevLabel: null,
            nextLabel: null,
            minDetail: "month",
            maxDetail: "month",
            onActiveStartDateChange: ({ activeStartDate }) => setEndActiveMonth(activeStartDate),
            tileClassName: ({ date, view }) => getRangeTileClassName(date, view)
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "quill-ui-next-daterange-picker-calendar-buttons", children: /* @__PURE__ */ jsxRuntime.jsx(
        index$3.BasicButton,
        {
          style: "secondary",
          size: "lg",
          label: "Today",
          color: "blackWhite",
          iconLeft: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedArrowLeftToLineSmBoldIcon, {}),
          onClick: showCurrentAndNextMonth
        }
      ) }),
      /* @__PURE__ */ jsxRuntime.jsx(
        index$2.IconButton,
        {
          className: "quill-ui-next-calendar-daterange-next-button quill-ui-next-calendar-daterange-button",
          style: "tertiary",
          size: "sm",
          icon: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronRightSmBoldIcon, {}),
          color: "blackWhite",
          onClick: () => handleMonthNavigation(1)
        }
      )
    ] });
  };
  const startValue = range[0] ? dateFns.format(range[0], mapFormatString(dateFormat)) : "";
  const endValue = range[1] ? dateFns.format(range[1], mapFormatString(dateFormat)) : "";
  const clearEndDate = () => setRange([range[0], null]);
  const clearRange = () => {
    setRange([null, null]);
    onChange == null ? void 0 : onChange(["", ""]);
  };
  const showCurrentAndNextMonth = () => {
    const now = /* @__PURE__ */ new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    setStartActiveMonth(startMonth);
    setEndActiveMonth(endMonth);
  };
  React.useEffect(() => {
    lastActiveInputRef.current = activeInput;
  }, [activeInput]);
  const renderMobileDateRangePicker = () => {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "quill-ui-next-calendar-daterange-container", children: /* @__PURE__ */ jsxRuntime.jsx(
      Calendar,
      {
        selectRange: true,
        value: range[0] && range[1] ? [range[0], range[1]] : range[0],
        onChange: handleMobileCalendarChange,
        locale: "en-GB",
        showNeighboringMonth: false,
        className: "quill-ui-next-calendar",
        minDate: parseToDate(minDate),
        maxDate: parseToDate(maxDate),
        navigationLabel: void 0,
        prevLabel: /* @__PURE__ */ jsxRuntime.jsx(
          index$2.IconButton,
          {
            style: "tertiary",
            size: "sm",
            icon: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronLeftSmBoldIcon, {}),
            color: "blackWhite"
          }
        ),
        nextLabel: /* @__PURE__ */ jsxRuntime.jsx(
          index$2.IconButton,
          {
            size: "sm",
            style: "tertiary",
            icon: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedChevronRightSmBoldIcon, {}),
            color: "blackWhite"
          }
        ),
        minDetail: "decade",
        maxDetail: "month",
        tileClassName: ({ date, view }) => getRangeTileClassName(date, view)
      }
    ) });
  };
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "quill-ui-next-daterange-picker-input-container", children: isMobile ? /* @__PURE__ */ jsxRuntime.jsx(
    index,
    {
      ...props,
      size,
      allowTyping: false,
      label: `${(inputStartDate == null ? void 0 : inputStartDate.label) || "From"} - ${(inputEndDate == null ? void 0 : inputEndDate.label) || "To"}`,
      placeholder: dateFormat,
      iconLeft: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedCalendarSmBoldIcon, {}),
      iconRight: /* @__PURE__ */ jsxRuntime.jsx(
        quillIcons.LabelPairedChevronDownSmBoldIcon,
        {
          className: `quill-ui-next-rotatable ${isOpen && "quill-ui-next-rotate"}`
        }
      ),
      iconExtra: isOpen && (range[0] || range[1]) ? /* @__PURE__ */ jsxRuntime.jsx(
        quillIcons.LabelPairedCircleXmarkSmBoldIcon,
        {
          className: "clear-btn",
          onClick: clearRange
        }
      ) : void 0,
      onChange: () => {
      },
      onClick: () => setIsOpen(true),
      value: displayValue,
      className: `${props.state !== "disabled" && "quill-ui-next-pointer"}`,
      customContent: /* @__PURE__ */ jsxRuntime.jsx(
        index$1.DropdownContainerAtom,
        {
          width: "fit-content",
          textAlignment: props.textAlignment,
          className: "quill-ui-next-daterange-picker-dropdown",
          parent: startInputRef,
          isOpen,
          offsetTop: props.variant === "labelless" ? datepickerContainerOffets[size] : 36,
          onActionSheetClose: () => setIsOpen(false),
          actionSheet: {
            ...actionSheet,
            buttonPrimary: {
              label: ((_a = actionSheet == null ? void 0 : actionSheet.buttonPrimary) == null ? void 0 : _a.label) || "Done",
              onClick: () => {
                setTimeout(() => {
                  var _a2;
                  setIsOpen(false);
                  (_a2 = actionSheet == null ? void 0 : actionSheet.onClose) == null ? void 0 : _a2.call(actionSheet);
                }, 100);
              }
            }
          },
          customContent: renderMobileDateRangePicker()
        }
      )
    }
  ) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      index,
      {
        ref: startInputRef,
        ...props,
        size,
        allowTyping: false,
        label: (inputStartDate == null ? void 0 : inputStartDate.label) || "From",
        placeholder: (inputStartDate == null ? void 0 : inputStartDate.placeholder) || dateFormat,
        iconLeft: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedArrowLeftToLineSmBoldIcon, {}),
        iconRight: /* @__PURE__ */ jsxRuntime.jsx(
          quillIcons.LabelPairedChevronDownSmBoldIcon,
          {
            className: `quill-ui-next-rotatable ${isOpen && "quill-ui-next-rotate"}`
          }
        ),
        iconExtra: isOpen && range[0] ? /* @__PURE__ */ jsxRuntime.jsx(
          quillIcons.LabelPairedCircleXmarkSmBoldIcon,
          {
            className: "clear-btn",
            onClick: clearRange
          }
        ) : void 0,
        messages: inputStartDate == null ? void 0 : inputStartDate.messages,
        message: inputStartDate == null ? void 0 : inputStartDate.message,
        indicator: inputStartDate == null ? void 0 : inputStartDate.indicator,
        onChange: () => {
        },
        onClick: () => handleInputClick("start"),
        value: startValue,
        className: `${props.state !== "disabled" && "quill-ui-next-pointer"}`,
        customContent: /* @__PURE__ */ jsxRuntime.jsx(
          index$1.DropdownContainerAtom,
          {
            width: "fit-content",
            textAlignment: props.textAlignment,
            className: "quill-ui-next-daterange-picker-dropdown",
            parent: startInputRef,
            isOpen,
            offsetTop: props.variant === "labelless" ? datepickerContainerOffets[size] : 36,
            onActionSheetClose: () => setIsOpen(false),
            customContent: renderDateRangePicker()
          }
        )
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(
      index,
      {
        ref: endInputRef,
        ...props,
        size,
        allowTyping: false,
        label: (inputEndDate == null ? void 0 : inputEndDate.label) || "To",
        placeholder: (inputEndDate == null ? void 0 : inputEndDate.placeholder) || dateFormat,
        iconLeft: /* @__PURE__ */ jsxRuntime.jsx(quillIcons.LabelPairedArrowRightToLineSmBoldIcon, {}),
        iconRight: /* @__PURE__ */ jsxRuntime.jsx(
          quillIcons.LabelPairedChevronDownSmBoldIcon,
          {
            className: `quill-ui-next-rotatable ${isOpen && "quill-ui-next-rotate"}`
          }
        ),
        iconExtra: isOpen && range[1] ? /* @__PURE__ */ jsxRuntime.jsx(
          quillIcons.LabelPairedCircleXmarkSmBoldIcon,
          {
            className: "clear-btn",
            onClick: clearEndDate
          }
        ) : void 0,
        messages: inputEndDate == null ? void 0 : inputEndDate.messages,
        message: inputEndDate == null ? void 0 : inputEndDate.message,
        indicator: inputEndDate == null ? void 0 : inputEndDate.indicator,
        onChange: () => {
        },
        onClick: () => handleInputClick("end"),
        value: endValue,
        className: `${props.state !== "disabled" && "quill-ui-next-pointer"}`
      }
    )
  ] }) });
};
exports.DateRangePicker = DateRangePicker;
exports.default = DateRangePicker;
//# sourceMappingURL=index28.cjs.map
