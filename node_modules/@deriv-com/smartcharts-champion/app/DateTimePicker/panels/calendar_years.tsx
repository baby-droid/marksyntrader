/* eslint-disable react/no-array-index-key */
import dayjs from '../../../src/utils/dayjs-config';
import { TCalendarViewProps } from '../calendar.props';

export const CalendarYears = ({ calendar_date, isPeriodDisabled, onClick, selected_date }: TCalendarViewProps) => {
    const selected_year = dayjs.utc(selected_date).year();
    const moment_date = dayjs.utc(calendar_date);
    const current_year = moment_date.year();
    const years = [];
    for (let year = current_year - 1; year < current_year + 11; year++) {
        years.push(year);
    }
    return (
        <div className='calendar-year-panel'>
            {years.map(year => (
                <span
                    key={year}
                    className={`calendar-year ${isPeriodDisabled(moment_date.year(year), 'year') ? 'disabled' : ''} ${
                        year === selected_year ? 'active' : ''
                    }`}
                    onClick={onClick.year}
                    data-year={year}
                >
                    {year}
                </span>
            ))}
        </div>
    );
};
