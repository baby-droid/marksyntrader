/* eslint-disable react/no-array-index-key */
import classNames from 'classnames';
import React from 'react';
import dayjs from '../../../src/utils/dayjs-config';

type TCalendarProps = {
    date_format: string;
    start_date?: number;
    max_date: string;
    min_date: string;
    calendar_date: string;
    onClick: {
        date: (e: React.SyntheticEvent<HTMLElement>, is_disabled: boolean) => void;
        month: (e: React.SyntheticEvent<HTMLElement>) => void;
        year: (e: React.SyntheticEvent<HTMLElement>) => void;
        decade: (e: React.SyntheticEvent<HTMLElement>) => void;
    };
    selected_date: string;
};

function padLeft(nr: number, n: number, str: string) {
    return Array(n - String(nr).length + 1).join(str || '0') + nr;
}

function calcDayIndexFromMonday(dayIndex: number) {
    return dayIndex === 0 ? 6 : dayIndex - 1;
}

const getDays = ({
    calendar_date,
    date_format,
    max_date,
    min_date,
    start_date,
    onClick,
    selected_date,
}: TCalendarProps) => {
    const dates = [];
    const days: React.ReactElement[] = [];
    const moment_today = dayjs().utc().startOf('day');
    const moment_cur_date = dayjs.utc(calendar_date);
    const num_of_days = moment_cur_date.daysInMonth() + 1;
    const moment_month_start = moment_cur_date.startOf('month');
    const moment_month_end = moment_cur_date.endOf('month');
    const first_day = calcDayIndexFromMonday(moment_month_start.day()); // dayjs method '.day()' return index the day of the week, with Sunday as 0 and Saturday as 6.
    const last_day = calcDayIndexFromMonday(moment_month_end.day());
    const moment_min_date = dayjs.utc(min_date);
    const moment_max_date = dayjs.utc(max_date);
    const moment_selected = dayjs.utc(selected_date);

    for (let i = first_day; i > 0; i--) {
        dates.push(moment_month_start.subtract(i, 'day').format(date_format));
    }
    for (let idx = 1; idx < num_of_days; idx += 1) {
        dates.push(moment_cur_date.format(date_format.replace('DD', padLeft(idx, 2, '0'))));
    }
    for (let i = 1; i <= 6 - last_day; i++) {
        dates.push(moment_month_end.add(i, 'day').format(date_format));
    }

    const moment_start_date = dayjs
        .unix(start_date || 0)
        .utc()
        .startOf('day');
    dates.map(date => {
        const moment_date = dayjs.utc(date).startOf('day');
        const is_active = selected_date && moment_date.isSame(moment_selected);
        const is_today = moment_date.isSame(moment_today, 'day');
        const is_disabled: boolean =
            moment_date.isBefore(moment_min_date) ||
            moment_date.isAfter(moment_max_date) ||
            // for forward starting accounts, only show same day as start date and the day after
            (start_date
                ? moment_date.isBefore(moment_start_date) || moment_date.isAfter(moment_start_date.add(1, 'day'))
                : false);

        const is_other_month = moment_date.month() !== moment_cur_date.month();

        days.push(
            <span
                key={date}
                className={classNames('calendar-date', {
                    active: is_active && !is_disabled,
                    today: is_today,
                    disabled: is_disabled,
                    'other-month': is_other_month,
                })}
                onClick={e => {
                    onClick.date(e, is_disabled);
                }}
                data-date={date}
            >
                {moment_date.date()}
            </span>
        );
    });

    return days;
};

const week_headers = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const CalendarDays = (props: TCalendarProps) => {
    const days = getDays(props).map(day => day);

    return (
        <div className='calendar-date-panel'>
            {week_headers.map((item, idx) => (
                <span key={idx} className='calendar-date-header'>
                    {item}
                </span>
            ))}
            {days}
        </div>
    );
};
