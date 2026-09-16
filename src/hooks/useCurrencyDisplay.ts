import { useCallback, useEffect, useState } from 'react';
import {
    currencyCode,
    DisplayCurrency,
    formatMoney,
    fromUsd,
    getDisplayCurrency,
    getFxRate,
    setDisplayCurrency,
    setFxRate,
    subscribeCurrency,
    toUsd,
} from '@/utils/currency-display';
import { useFxRate } from './useFxRate';

/**
 * React hook over the global display-currency store. Re-renders when the user
 * toggles USD/KSH or when the live FX rate updates.
 */
export const useCurrencyDisplay = () => {
    const [, force] = useState(0);
    const liveRate = useFxRate('USD', 'KES');

    useEffect(() => subscribeCurrency(() => force(n => n + 1)), []);

    // Push the freshest live rate into the shared store.
    useEffect(() => {
        if (liveRate) setFxRate(liveRate);
    }, [liveRate]);

    const setCurrency = useCallback((c: DisplayCurrency) => setDisplayCurrency(c), []);
    const toggle = useCallback(
        () => setDisplayCurrency(getDisplayCurrency() === 'USD' ? 'KSH' : 'USD'),
        []
    );

    return {
        currency: getDisplayCurrency(),
        code: currencyCode(),
        fxRate: getFxRate(),
        setCurrency,
        toggle,
        format: formatMoney,
        fromUsd,
        toUsd,
    };
};

export default useCurrencyDisplay;
