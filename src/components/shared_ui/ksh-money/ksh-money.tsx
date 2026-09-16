import React, { useEffect, useState } from 'react';
import Money from '@/components/shared_ui/money';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';

/**
 * KSH-aware money display.
 * When the user's display currency is KSH we convert the USD amount using
 * fromUsd() and label it KSH. Otherwise we fall back to the standard
 * Money component so formatting / rounding stays consistent.
 *
 * This is the single shared implementation — reuse this everywhere a
 * profit/stake/payout total is rendered so KSH mode stays consistent across
 * Transactions, Summary, Run Panel and the Journal.
 */
const KshMoney: React.FC<{
    amount: number;
    contractCurrency: string;
    showCurrency?: boolean;
    hasSign?: boolean;
    className?: string;
}> = ({ amount, contractCurrency, showCurrency = false, hasSign = false, className }) => {
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    if (displayCur === 'USD' || displayCur === contractCurrency) {
        return (
            <Money
                amount={amount}
                currency={contractCurrency}
                show_currency={showCurrency}
                has_sign={hasSign}
                className={className}
            />
        );
    }
    // KSH (or other non-USD display) mode — convert + label
    const converted = fromUsd(amount);
    const sign = hasSign && converted > 0 ? '+' : '';
    const formatted = converted.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (
        <span className={className}>
            {sign}
            {formatted}
            {showCurrency ? ` ${displayCur}` : ''}
        </span>
    );
};

export default KshMoney;

/** Plain-number helper for places that can't render JSX (e.g. .toFixed(2) call sites). */
export const formatKshAmount = (amountUsd: number): { value: string; currency: string } => {
    const displayCur = getDisplayCurrency();
    const converted = fromUsd(amountUsd);
    return { value: converted.toFixed(2), currency: displayCur };
};
