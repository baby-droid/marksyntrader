import { default as React } from 'react';
import { ActionSheetType } from '../../../components/action-sheet';
import { DropdownContainerType } from '../container/';
/**
 * Scrolls the given list container to the item at the specified index.
 * @param listContainer The container element to scroll.
 * @param itemIdx The index of the item to scroll to (not counting padding items).
 * @param itemSize "sm" or "md" (determines item height).
 */
export declare function scrollListContainerToItem(listContainer: HTMLDivElement, itemIdx: number, itemSize?: "sm" | "md"): void;
export interface WheelpickerContainerType extends DropdownContainerType {
    itemWidth?: "fill" | "fit-content";
    actionsheet?: ActionSheetType;
}
export declare const WheelpickerContainerAtom: React.FC<WheelpickerContainerType>;
export default WheelpickerContainerAtom;
