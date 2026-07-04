import { FunctionComponent } from 'react';
import { BaseCardProps } from '../base';
export type CardBasicHorizontalType = Omit<BaseCardProps, "layout" | "renderLayout">;
export declare const CardBasicHorizontal: FunctionComponent<CardBasicHorizontalType>;
export default CardBasicHorizontal;
