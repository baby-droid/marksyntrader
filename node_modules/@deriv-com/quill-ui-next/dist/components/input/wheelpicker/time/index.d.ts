import { FunctionComponent } from 'react';
import { GenericWheelpickerType } from '../generic';
interface TimeWheelpickerProps extends GenericWheelpickerType {
    format?: "12" | "24";
}
export declare const TimeWheelpicker: FunctionComponent<Omit<TimeWheelpickerProps, "itemWidth">>;
export default TimeWheelpicker;
