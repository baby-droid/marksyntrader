"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const jsxRuntime = require("react/jsx-runtime");
const React = require("react");
const index = require("./index118.cjs");
const defaultMonthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const defaultDayLabels = Array.from({ length: 31 }, (_, i) => String(i + 1));
const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};
const getYearRange = (min, max) => {
  const years = [];
  for (let y = min.getFullYear(); y <= max.getFullYear(); y++) {
    years.push(y);
  }
  return years;
};
const DateWheelpicker = ({ minDate, maxDate, selected, monthsList, daysList, ...props }) => {
  var _a, _b;
  const today = /* @__PURE__ */ new Date();
  const min = minDate ? new Date(minDate) : new Date(today.getFullYear() - 100, 0, 1);
  const max = maxDate ? new Date(maxDate) : new Date(today.getFullYear() + 10, 11, 31);
  const [value, setValue] = React.useState(() => {
    if (selected && selected.length === 3) return selected;
    return [
      { label: String(today.getDate()), value: String(today.getDate()) },
      {
        label: defaultMonthNames[today.getMonth()],
        value: String(today.getMonth())
      },
      {
        label: String(today.getFullYear()),
        value: String(today.getFullYear())
      }
    ];
  });
  const selectedMonth = ((_a = value[1]) == null ? void 0 : _a.value) !== void 0 ? Number(value[1].value) : today.getMonth();
  const selectedYear = ((_b = value[2]) == null ? void 0 : _b.value) !== void 0 ? Number(value[2].value) : today.getFullYear();
  const monthNames = monthsList && monthsList.length === 12 ? monthsList : defaultMonthNames;
  const dayLabels = daysList && daysList.length >= 28 ? daysList : defaultDayLabels;
  const years = React.useMemo(
    () => getYearRange(min, max).map((y) => ({
      label: String(y),
      value: String(y)
    })),
    [min, max]
  );
  const months = React.useMemo(() => {
    let start = 0, end = 11;
    if (selectedYear === min.getFullYear()) start = min.getMonth();
    if (selectedYear === max.getFullYear()) end = max.getMonth();
    return monthNames.slice(start, end + 1).map((m, i) => ({ label: m, value: String(i + start) }));
  }, [selectedYear, min, max, monthNames]);
  const days = React.useMemo(() => {
    let daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    let start = 1, end = daysInMonth;
    if (selectedYear === min.getFullYear() && selectedMonth === min.getMonth()) {
      start = min.getDate();
    }
    if (selectedYear === max.getFullYear() && selectedMonth === max.getMonth())
      end = max.getDate();
    return Array.from({ length: end - start + 1 }, (_, i) => ({
      label: dayLabels[i + start - 1] || String(i + start),
      value: String(i + start)
    }));
  }, [selectedYear, selectedMonth, min, max, dayLabels]);
  const data = React.useMemo(
    () => [{ items: days }, { items: months }, { items: years }],
    [days, months, years]
  );
  const selectedDayObj = days.find((d) => {
    var _a2;
    return d.value === ((_a2 = value[0]) == null ? void 0 : _a2.value);
  });
  const selectedMonthObj = months.find((m) => {
    var _a2;
    return m.value === ((_a2 = value[1]) == null ? void 0 : _a2.value);
  });
  const selectedYearObj = years.find((y) => {
    var _a2;
    return y.value === ((_a2 = value[2]) == null ? void 0 : _a2.value);
  });
  const customValue = `${(selectedDayObj == null ? void 0 : selectedDayObj.label) || "--"} ${(selectedMonthObj == null ? void 0 : selectedMonthObj.label) || "--"} ${(selectedYearObj == null ? void 0 : selectedYearObj.label) || "--"}`;
  React.useEffect(() => {
    var _a2;
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    let start = 1, end = daysInMonth;
    if (selectedYear === min.getFullYear() && selectedMonth === min.getMonth()) {
      start = min.getDate();
    }
    if (selectedYear === max.getFullYear() && selectedMonth === max.getMonth()) {
      end = max.getDate();
    }
    const selectedDay = Number((_a2 = value[0]) == null ? void 0 : _a2.value);
    if (selectedDay < start || selectedDay > end) {
      setValue([
        { label: String(end), value: String(end) },
        value[1],
        value[2]
      ]);
    }
  }, [selectedYear, selectedMonth, min, max]);
  return /* @__PURE__ */ jsxRuntime.jsx(
    index,
    {
      ...props,
      data,
      selected: value,
      customValue,
      onChange: (e) => setValue(e),
      itemWidth: "fill",
      textAlignment: "center"
    }
  );
};
DateWheelpicker.displayName = "DateWheelpicker";
exports.DateWheelpicker = DateWheelpicker;
exports.default = DateWheelpicker;
//# sourceMappingURL=index41.cjs.map
