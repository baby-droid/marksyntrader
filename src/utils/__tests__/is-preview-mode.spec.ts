import { isPreviewMode } from '../is-preview-mode';

describe('isPreviewMode', () => {
    const original = process.env.NEXT_PUBLIC_APP_BUILD;
    const originalPath = window.location.pathname;

    afterEach(() => {
        process.env.NEXT_PUBLIC_APP_BUILD = original;
        window.history.replaceState({}, '', originalPath);
    });

    it('returns true when NEXT_PUBLIC_APP_BUILD is "true" (App Builder preview build)', () => {
        process.env.NEXT_PUBLIC_APP_BUILD = 'true';
        expect(isPreviewMode()).toBe(true);
    });

    it('returns false for a standalone partner deploy (flag unset)', () => {
        delete process.env.NEXT_PUBLIC_APP_BUILD;
        expect(isPreviewMode()).toBe(false);
    });

    it('returns false when the flag is any other value', () => {
        process.env.NEXT_PUBLIC_APP_BUILD = 'false';
        expect(isPreviewMode()).toBe(false);
    });

    it('recognizes the preview pathname when the dev workflow has no build flag', () => {
        delete process.env.NEXT_PUBLIC_APP_BUILD;
        window.history.replaceState({}, '', '/bot/preview');
        expect(isPreviewMode()).toBe(true);
    });
});
