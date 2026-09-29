/**
 * Opens Deriv Home's deposit sheet for real accounts.
 *
 * The deposit flow is intentionally opened in a separate tab. That keeps the
 * authenticated Marksyntrader tab alive as the return surface after the user
 * completes or closes the deposit flow, and lets its existing balance
 * subscription receive the updated balance.
 */
import { useCallback, useState } from 'react';

const DERIV_DEPOSIT_URL =
    'https://home.deriv.com/dashboard/deposit?from=home&depositSheet=1&currency=USD';

export type DepositState = 'idle' | 'loading' | 'error';

export const useDepositReal = () => {
    const [state, setState] = useState<DepositState>('idle');

    const openDeposit = useCallback(() => {
        setState('loading');
        try {
            // Keep Marksyntrader open while the external deposit sheet is active.
            // Deriv Home does not expose a documented browser callback parameter
            // for this URL, so the original tab is the reliable return surface.
            const opened = window.open(DERIV_DEPOSIT_URL, '_blank', 'noopener,noreferrer');
            if (!opened) throw new Error('Deposit window was blocked');
            const onReturn = () => {
                if (!opened.closed) return;
                window.removeEventListener('focus', onReturn);
                const callbackUrl = new URL(window.location.href);
                callbackUrl.searchParams.set('deposit', 'success');
                window.history.replaceState({}, '', callbackUrl.toString());
                window.dispatchEvent(new PopStateEvent('popstate'));
            };
            window.addEventListener('focus', onReturn);
            setState('idle');
        } catch {
            setState('error');
            setTimeout(() => setState('idle'), 2500);
        }
    }, []);

    return { state, openDeposit };
};

export default useDepositReal;
