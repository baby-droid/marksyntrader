import { fontFamilyStack, loadWebFont } from './load-web-font';

/**
 * Applies a partner primary color to the runtime CSS variables.
 *
 * The visible UI (buttons, accents) reads --brand-red-coral (see _themes.scss
 * --button-primary-default), while --brand-primary is the semantic name. We set
 * both at :root so a live App Builder preview matches the deployed output, where
 * generate-brand-css.js bakes colors.primary into the same two variables.
 */
export function applyPrimaryColor(color: string): void {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', color);
    root.style.setProperty('--brand-red-coral', color);
}

/** Loads the chosen web font and applies it to the body font var (--brand-font-primary). */
export function applyBrandFont(family: string): void {
    loadWebFont(family);
    document.documentElement.style.setProperty('--brand-font-primary', fontFamilyStack(family));
}
