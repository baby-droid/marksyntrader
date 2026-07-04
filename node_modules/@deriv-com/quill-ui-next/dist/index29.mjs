import { jsx } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import TextFieldAtom from "./index94.mjs";
import { LabelPairedChevronDownSmBoldIcon, LabelPairedCalendarSmBoldIcon, LabelPairedChevronLeftSmBoldIcon, LabelPairedChevronRightSmBoldIcon } from "@deriv/quill-icons";
import { useClickOutside } from "./index47.mjs";
import { DropdownContainerAtom } from "./index111.mjs";
/* empty css         */
/* empty css         */
import Calendar from "react-calendar";
import { parse, format } from "date-fns";
import { c as clientExports } from "./index98.mjs";
import { IconButton } from "./index35.mjs";
const Datepicker = ({
  dateFormat = "dd/mm/yyyy",
  size = "md",
  minDate,
  maxDate,
  ...props
}) => {
  const [value, setValue] = useState(props.value);
  const [isOpen, setIsOpen] = useState(false);
  const datepickerRef = useRef(null);
  const prevFormatRef = useRef(dateFormat);
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
      const parsed = parse(value2, formatString, /* @__PURE__ */ new Date());
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
    const formattedDate = format(date, formatString);
    (_a = datepickerRef.current) == null ? void 0 : _a.focus();
    setValue(formattedDate);
    (_b = props.onChange) == null ? void 0 : _b.call(props, formattedDate);
    setTimeout(() => {
      setIsOpen(false);
    }, 100);
  };
  useEffect(() => {
    if (isOpen) {
      const calendar = document.querySelector(".quill-ui-next-calendar");
      const setNavIcon = (selector, icon) => {
        const nav = calendar == null ? void 0 : calendar.querySelector(selector);
        if (nav) {
          nav.innerHTML = "";
          const container = document.createElement("span");
          nav.appendChild(container);
          clientExports.createRoot(container).render(icon);
        }
      };
      setNavIcon(
        ".react-calendar__navigation__prev-button",
        /* @__PURE__ */ jsx(
          IconButton,
          {
            style: "tertiary",
            size: "sm",
            icon: /* @__PURE__ */ jsx(LabelPairedChevronLeftSmBoldIcon, {}),
            color: "blackWhite"
          }
        )
      );
      setNavIcon(
        ".react-calendar__navigation__next-button",
        /* @__PURE__ */ jsx(
          IconButton,
          {
            size: "sm",
            style: "tertiary",
            icon: /* @__PURE__ */ jsx(LabelPairedChevronRightSmBoldIcon, {}),
            color: "blackWhite"
          }
        )
      );
    }
  }, [isOpen]);
  useEffect(() => {
    var _a;
    if (value && prevFormatRef.current !== dateFormat) {
      const prevFormatString = mapFormatString(prevFormatRef.current);
      const date = parse(value, prevFormatString, /* @__PURE__ */ new Date());
      if (!isNaN(date.getTime())) {
        const newFormatString = mapFormatString(dateFormat);
        const newValue = format(date, newFormatString);
        setValue(newValue);
        (_a = props.onChange) == null ? void 0 : _a.call(props, newValue);
      }
      prevFormatRef.current = dateFormat;
    }
  }, [dateFormat]);
  useClickOutside(
    datepickerRef,
    () => {
      setIsOpen(false);
    },
    ["quill-ui-next-calendar"]
  );
  return /* @__PURE__ */ jsx(
    TextFieldAtom,
    {
      ref: datepickerRef,
      ...props,
      size,
      allowTyping: false,
      placeholder: dateFormat,
      iconLeft: /* @__PURE__ */ jsx(LabelPairedCalendarSmBoldIcon, {}),
      iconRight: /* @__PURE__ */ jsx(
        LabelPairedChevronDownSmBoldIcon,
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
      customContent: /* @__PURE__ */ jsx(
        DropdownContainerAtom,
        {
          width: "fit-content",
          textAlignment: props.textAlignment,
          parent: datepickerRef,
          isOpen,
          offsetTop: props.variant === "labelless" ? datepickerContainerOffets[size] : 35,
          onActionSheetClose: () => setIsOpen(false),
          customContent: /* @__PURE__ */ jsx(
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
export {
  Datepicker,
  Datepicker as default
};
//# sourceMappingURL=index29.mjs.map
