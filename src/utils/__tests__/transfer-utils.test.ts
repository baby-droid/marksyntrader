import { navigateToTransfer } from '../transfer-utils';

jest.mock('@/components/shared/utils/routes/routes', () => ({
    standalone_routes: {
        transfer: 'https://home.deriv.com/dashboard/transfer?acc=options&from=home&source=options',
    },
}));

jest.mock('@deriv-com/translations', () => ({
    getInitialLanguage: jest.fn(() => 'en'),
}));

import { getInitialLanguage } from '@deriv-com/translations';

const TRANSFER_BASE = 'https://home.deriv.com/dashboard/transfer?acc=options&from=home&source=options';

describe('navigateToTransfer', () => {
    let openSpy: jest.SpyInstance;

    beforeEach(() => {
        openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        (getInitialLanguage as jest.Mock).mockReturnValue('en');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('opens the transfer page in a new tab with currency and language params', () => {
        navigateToTransfer('USD');

        expect(openSpy).toHaveBeenCalledWith(
            `${TRANSFER_BASE}&curr=USD&lang=en`,
            '_blank',
            'noopener,noreferrer'
        );
    });

    it('omits the lang param when no language is available', () => {
        (getInitialLanguage as jest.Mock).mockReturnValue('');

        navigateToTransfer('EUR');

        expect(openSpy).toHaveBeenCalledWith(`${TRANSFER_BASE}&curr=EUR`, '_blank', 'noopener,noreferrer');
    });

    it('never navigates the current tab away (window.location.href untouched)', () => {
        const hrefSetter = jest.fn();
        const originalLocation = window.location;
        // Redefine location so we can detect any same-tab navigation attempt
        delete (window as { location?: Location }).location;
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, set href(v: string) { hrefSetter(v); } },
        });

        navigateToTransfer('USD');

        expect(hrefSetter).not.toHaveBeenCalled();
        expect(openSpy).toHaveBeenCalledTimes(1);

        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    });

    it('falls back to opening the base transfer URL in a new tab when URL building throws', () => {
        (getInitialLanguage as jest.Mock).mockImplementation(() => {
            throw new Error('boom');
        });

        navigateToTransfer('USD');

        expect(openSpy).toHaveBeenCalledWith(TRANSFER_BASE, '_blank', 'noopener,noreferrer');
    });
});
