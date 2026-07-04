import { ComponentProps } from 'react';

type TotalAssetProps = Omit<ComponentProps<"div">, "title"> & {
    title: string | JSX.Element;
    description: string | JSX.Element;
    value: string | JSX.Element;
};
export declare const TotalAsset: ({ title, description, value, className, ...rest }: TotalAssetProps) => import("react").JSX.Element;
export {};
