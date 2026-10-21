import { getErrorMessage } from './error-handler';

describe('getErrorMessage', () => {
    it('prefers a useful nested message over a generic wrapper message', () => {
        expect(getErrorMessage({
            message: 'An error occurred. Please try again.',
            details: { message: 'Subscription limit exceeded' },
        })).toBe('Subscription limit exceeded');
    });

    it('reads a useful message from a nested API response', () => {
        expect(getErrorMessage({
            message: 'A general error has occurred.',
            response: { data: { error: { message: 'The bot could not subscribe to ticks.' } } },
        })).toBe('The bot could not subscribe to ticks.');
    });

    it('keeps the generic message only when no detailed message exists', () => {
        expect(getErrorMessage({ message: 'An error occurred. Please try again.' }))
            .toBe('An error occurred. Please try again.');
    });
});
