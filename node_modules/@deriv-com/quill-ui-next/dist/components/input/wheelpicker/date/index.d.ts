import { FunctionComponent } from 'react';
import { GenericWheelpickerType } from '../generic';
interface DateWheelpickerProps extends GenericWheelpickerType {
    minDate?: Date;
    maxDate?: Date;
    monthsList?: string[];
    daysList?: string[];
}
export declare const DateWheelpicker: FunctionComponent<Omit<DateWheelpickerProps, "itemWidth">>;
export default DateWheelpicker;
