import { standalone_routes } from '@/components/shared/utils/routes/routes';
import { getInitialLanguage } from '@deriv-com/translations';
import { openInNewTab } from './navigation-utils';

/**
 * Opens the transfer page in a new tab with the specified currency and language parameters.
 * The transfer flow lives on home.deriv.com; opening it in a new tab keeps the deployed bot
 * open in the original tab so the user returns to it simply by switching back (the home
 * success screen does not redirect back to the bot).
 * @param currency The currency to use for the transfer
 */
export const navigateToTransfer = (currency: string): void => {
    try {
        // Get the base URL from standalone_routes
        const baseUrl = standalone_routes.transfer;

        // Get the current language
        const currentLanguage = getInitialLanguage();
        const lang_param = currentLanguage ? `&lang=${currentLanguage}` : '';

        // Generate the transfer URL with currency and language parameters
        const transferUrl = `${baseUrl}&curr=${currency}${lang_param}`;

        // Open the transfer URL in a new tab so the bot stays open
        openInNewTab(transferUrl);
    } catch (error) {
        console.error('Error navigating to transfer page:', error);
        // Fallback to the basic transfer URL
        openInNewTab(standalone_routes.transfer);
    }
};
