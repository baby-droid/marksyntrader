import { FunctionComponent, ReactNode } from 'react';
export type DropdownTitleAtomType = {
    className?: string;
    title?: string;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
};
declare const DropdownTitleAtom: FunctionComponent<DropdownTitleAtomType>;
export default DropdownTitleAtom;
