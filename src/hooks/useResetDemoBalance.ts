/**
 * Shared hook: reset a virtual/demo account balance back to 10,000 USD
 * via Deriv's `topup_virtual` API call.
 *
 * Exported from here so both the account-switcher inline button and the
 * header's left-side reset button share exactly the same logic.
 */
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

export const useResetDemoBalance = () => {
    const [isResetting, setIsResetting] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);
    const [resetSuccess, setResetSuccess] = useState(false);

    const resetBalance = useCallback(async () => {
        if (isResetting) return;
        if (!api_base.api) {
            toast.error('Not connected to Deriv API. Please log in first.', { autoClose: 3500 });
            return;
        }
        setIsResetting(true);
        setResetError(null);
        setResetSuccess(false);
        try {
            const response = await (api_base.api as any).send({ topup_virtual: 1 });
            if (response?.error) {
                const msg = response.error.message || response.error.code || 'Reset failed';
                setResetError(msg);
                toast.error(`Reset failed: ${msg}`, { autoClose: 4000 });
            } else {
                setResetSuccess(true);
                toast.success('✅ Demo balance reset to 10,000 USD!', { autoClose: 3000 });
                // Restart the live balance subscription so every component that
                // reads the balance (header, account-switcher, etc.) gets the new
                // amount pushed through without needing a page reload.
                (api_base.api as any).send({ balance: 1, subscribe: 1 }).catch(() => {});
                // Also ask for an account-status refresh so the store is current.
                (api_base.api as any).send({ get_account_status: 1 }).catch(() => {});
                // Clear success flash after 2 s
                setTimeout(() => setResetSuccess(false), 2000);
            }
        } catch (e: any) {
            // DerivAPIBasic rejects with { error: { message, code } } on failure
            const msg = e?.error?.message || e?.message || 'Reset failed';
            setResetError(msg);
            toast.error(`Reset failed: ${msg}`, { autoClose: 4000 });
        } finally {
            setIsResetting(false);
        }
    }, [isResetting]);

    return { isResetting, resetError, resetSuccess, resetBalance };
};

export default useResetDemoBalance;
