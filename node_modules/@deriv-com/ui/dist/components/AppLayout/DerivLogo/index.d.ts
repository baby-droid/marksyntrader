import { ComponentProps } from 'react';

type TDerivLogo = ComponentProps<"a"> & {
    variant?: "default" | "wallets";
    logoWidth?: number;
    logoHeight?: number;
};
/**
 * Renders the Deriv logo component.
 * @param {"default" | "wallets"} [variant="default"] - Specifies the variant of the logo.
 * @param {number} [logoWidth] - Width of the logo.
 * @param {number} [logoHeight] - Height of the logo.
 * @param {ComponentProps<'a'>} [props] - HTML a tag props.
 * @returns {JSX.Element} - Rendered Deriv logo component.
 */
export declare const DerivLogo: {
    ({ variant, logoHeight, logoWidth, ...props }: TDerivLogo): import("react").JSX.Element;
    displayName: string;
};
export {};
