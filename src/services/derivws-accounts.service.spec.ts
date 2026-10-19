jest.mock('@/external/deriv-core', () => ({
    getApiBaseUrl: () => 'https://api.derivws.com/trading/v1/options',
}));

import { DerivWSAccountsService } from './derivws-accounts.service';

describe('DerivWSAccountsService authenticated WebSocket account selection', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        DerivWSAccountsService.clearCache();
        localStorage.setItem('active_loginid', 'VRTC-selected');
    });

    afterEach(() => {
        global.fetch = originalFetch;
        DerivWSAccountsService.clearCache();
    });

    it('refreshes stale account data and requests OTP for the selected account', async () => {
        sessionStorage.setItem(
            'deriv_accounts',
            JSON.stringify([{ account_id: 'VRTC-stale', account_type: 'demo', balance: '0', currency: 'USD', group: '', status: 'active' }])
        );

        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [
                        { account_id: 'VRTC-selected', account_type: 'demo', balance: '0', currency: 'USD', group: '', status: 'active' },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: { url: 'wss://api.derivws.com/trading/v1/options/ws/demo?otp=one-time' } }),
            });
        global.fetch = fetchMock;

        const url = await DerivWSAccountsService.getAuthenticatedWebSocketURL('test-access-token');

        expect(url).toContain('/ws/demo?otp=');
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            'https://api.derivws.com/trading/v1/options/accounts',
            expect.objectContaining({ method: 'GET' })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            'https://api.derivws.com/trading/v1/options/accounts/VRTC-selected/otp',
            expect.objectContaining({ method: 'POST' })
        );
    });
});
