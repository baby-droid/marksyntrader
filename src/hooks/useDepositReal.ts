/**
 * Opens the Deriv cashier deposit page for real accounts.
 *
 * Deriv's `cashier` API returns a URL (or iframe URL) to the payment provider
 * page. We open that in a new tab so the user can complete a deposit; the
 * resulting balance credit hits their Deriv account and the app's balance
 * subscription will reflect it automatically.
 *
 * Fallback: if the API call fails or is not available, we open the public
 * Deriv cashier page directly.
 */
import { useCallback, useState } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const CASHIER_FALLBACK = 'https://app.deriv.com/cashier/deposit';

export type DepositState = 'idle' | 'loading' | 'error';

export const useDepositReal = () => {
    const [state, setState] = useState<DepositState>('idle');

    const openDeposit = useCallback(async () => {
        setState('loading');
        try {
            if (api_base.api) {
                const res = await (api_base.api as any).send({
                    cashier: 'deposit',
                    provider: 'doughflow',
                    type: 'url',
                });
                if (res?.cashier && typeof res.cashier === 'string' && res.cashier.startsWith('http')) {
                    window.open(res.cashier, '_blank', 'noopener,noreferrer');
                    setState('idle');
                    return;
                }
            }
            // Fallback — open public cashier page
            window.open(CASHIER_FALLBACK, '_blank', 'noopener,noreferrer');
            setState('idle');
        } catch {
            // On any error, still open the fallback so the user isn't stuck
            window.open(CASHIER_FALLBACK, '_blank', 'noopener,noreferrer');
            setState('error');
            setTimeout(() => setState('idle'), 2500);
        }
    }, []);

    return { state, openDeposit };
};

export default useDepositReal;
