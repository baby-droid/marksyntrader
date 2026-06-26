import { localize } from '@deriv-com/translations';

export const getDefaultError = () => ({
    header: localize('Sorry for the interruption'),
    description: localize('Our servers hit a bump. Let’s refresh to move on.'),
    cta_label: localize('Refresh'),
});

export const getAuthError = () => ({
    header: localize('The token is invalid'),
    description: localize('Please log in'),
    cta_label: localize('Log in'),
});

export const STATUS_CODES = Object.freeze({
    NONE: 'none',
    PENDING: 'pending',
    REJECTED: 'rejected',
    VERIFIED: 'verified',
    EXPIRED: 'expired',
    SUSPECTED: 'suspected',
});
