import { FunctionComponent } from 'react';
import { BaseCardProps } from '../base';
export type CardBasicVerticalType = Omit<BaseCardProps, "layout" | "renderLayout">;
export declare const CardBasicVertical: FunctionComponent<CardBasicVerticalType>;
export default CardBasicVertical;
