/**
 * Shared hook: reset a virtual/demo account balance back to 10,000 USD
 * via Deriv's `topup_virtual` API call.
 *
 * Exported from here so both the account-switcher inline button and the
 * header's left-side reset button share exactly the same logic.
 */
import { useCallback, useState } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

export const useResetDemoBalance = () => {
    const [isResetting, setIsResetting] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);
    const [resetSuccess, setResetSuccess] = useState(false);

    const resetBalance = useCallback(async () => {
        if (isResetting || !api_base.api) return;
        setIsResetting(true);
        setResetError(null);
        setResetSuccess(false);
        try {
            const response = await (api_base.api as any).send({ topup_virtual: 1 });
            if (response?.error) {
                setResetError(response.error.message || 'Reset failed');
            } else {
                setResetSuccess(true);
                // Trigger a fresh balance fetch so the header updates immediately
                (api_base.api as any).send({ balance: 1 }).catch(() => {});
                // Clear success flash after 2 s
                setTimeout(() => setResetSuccess(false), 2000);
            }
        } catch (e: any) {
            setResetError(e?.message || 'Reset failed');
        } finally {
            setIsResetting(false);
        }
    }, [isResetting]);

    return { isResetting, resetError, resetSuccess, resetBalance };
};

export default useResetDemoBalance;
