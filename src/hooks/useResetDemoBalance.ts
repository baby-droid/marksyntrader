/**
 * Shared hook: reset a virtual/demo account balance back to 10,000 USD
 * via Deriv's `topup_virtual` API call.
 *
 * The hook ensures the WebSocket connection is authorized with the demo
 * account's token before calling topup_virtual, so it works even when
 * the active connection was last used for a different account.
 */
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

/** Try to extract the virtual account's access token from localStorage. */
function getVirtualToken(): string | null {
    try {
        // 1. Stored as 'client.accounts' (Deriv-style JSON object keyed by loginid)
        const raw = localStorage.getItem('client.accounts');
        if (raw) {
            const accs = JSON.parse(raw);
            for (const [loginid, data] of Object.entries(accs as Record<string, any>)) {
                if ((loginid.startsWith('VRTC') || loginid.startsWith('VR')) && data?.token) {
                    return data.token;
                }
            }
        }

        // 2. Stored as 'accountsList' (object keyed by loginid → token string)
        const al = localStorage.getItem('accountsList');
        if (al) {
            const map = JSON.parse(al);
            const activeId = localStorage.getItem('active_loginid') ?? '';
            if ((activeId.startsWith('VRTC') || activeId.startsWith('VR')) && map[activeId]) {
                return map[activeId];
            }
            // Any virtual account
            for (const [id, tok] of Object.entries(map as Record<string, any>)) {
                if (id.startsWith('VRTC') || id.startsWith('VR')) return tok as string;
            }
        }

        // 3. Stored as 'deriv_token' or 'client.token'
        const single = localStorage.getItem('client.token') ?? localStorage.getItem('deriv_token');
        if (single) return single;

        return null;
    } catch {
        return null;
    }
}

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
            // Ensure we are authorized as the virtual account.
            // api_base.account_info is set after a successful `authorize` response.
            const accInfo: any = (api_base as any).account_info;
            if (!accInfo?.is_virtual) {
                const virtToken = getVirtualToken();
                if (virtToken) {
                    const authResp = await (api_base.api as any).send({ authorize: virtToken });
                    if (authResp?.error) {
                        throw new Error(authResp.error.message ?? 'Authorization failed');
                    }
                } else {
                    // No virtual token found — proceed anyway (connection may already be demo)
                    console.warn('useResetDemoBalance: no virtual token found in localStorage');
                }
            }

            // Now call topup_virtual to reset demo balance
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
