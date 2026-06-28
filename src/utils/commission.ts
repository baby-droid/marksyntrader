/**
 * Markup commission rate applied to all winning trades.
 * 2.5% of every profit is deducted as platform commission.
 */
export const MARKUP_RATE = 0.025;

/**
 * Apply 2.5% commission to a profit figure.
 * Only winning trades (profit > 0) are charged.
 * Losses and break-even results are passed through unchanged.
 */
export function applyCommission(profit: number): number {
    if (profit > 0) return profit * (1 - MARKUP_RATE);
    return profit;
}

/**
 * Calculate the commission amount deducted from a winning trade.
 * Returns 0 for losses / break-even.
 */
export function commissionAmount(profit: number): number {
    if (profit > 0) return profit * MARKUP_RATE;
    return 0;
}
