/**
 * Global display-currency store (USD <-> KSH).
 *
 * The Deriv account always trades in its native currency (usually USD); this
 * module only controls how amounts are *displayed* and lets the user type
 * stakes in KSH. It keeps a module-level singleton so any component — even
 * outside the React tree — can read/convert consistently, plus a React hook
 * (`useCurrencyDisplay`) that re-renders on change.
 */

export type DisplayCurrency = 'USD' | 'KSH';

const STORAGE_KEY = 'display_currency';
const FALLBACK_USD_KES = 129;

type Listener = () => void;

let displayCurrency: DisplayCurrency =
    (typeof localStorage !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as DisplayCurrency)) === 'KSH'
        ? 'KSH'
        : 'USD';
let fxRate = FALLBACK_USD_KES; // USD -> KES

const listeners = new Set<Listener>();

const emit = () => listeners.forEach(l => l());

export const subscribeCurrency = (cb: Listener): (() => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
};

export const getDisplayCurrency = (): DisplayCurrency => displayCurrency;

export const setDisplayCurrency = (c: DisplayCurrency): void => {
    if (c === displayCurrency) return;
    displayCurrency = c;
    try {
        localStorage.setItem(STORAGE_KEY, c);
    } catch {
        /* ignore */
    }
    emit();
};

export const getFxRate = (): number => fxRate;

export const setFxRate = (r: number): void => {
    if (!r || r <= 0 || r === fxRate) return;
    fxRate = r;
    emit();
};

/** Convert a USD amount into the current display currency's numeric value. */
export const fromUsd = (amountUsd: number): number =>
    displayCurrency === 'KSH' ? amountUsd * fxRate : amountUsd;

/** Convert an amount typed in the current display currency back to USD. */
export const toUsd = (amountDisplay: number): number =>
    displayCurrency === 'KSH' ? amountDisplay / fxRate : amountDisplay;

const addThousands = (n: number, dp: number): string =>
    n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** Format a USD amount for display in the currently selected currency. */
export const formatMoney = (
    amountUsd: number,
    { code = true, decimals }: { code?: boolean; decimals?: number } = {}
): string => {
    const value = fromUsd(amountUsd);
    const dp = decimals ?? (displayCurrency === 'KSH' ? 2 : 2);
    const num = addThousands(value, dp);
    return code ? `${num} ${displayCurrency === 'KSH' ? 'KSH' : 'USD'}` : num;
};

export const currencyCode = (): string => (displayCurrency === 'KSH' ? 'KSH' : 'USD');
