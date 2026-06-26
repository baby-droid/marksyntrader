import { isPreviewMode } from '../is-preview-mode';

describe('isPreviewMode', () => {
    const original = process.env.NEXT_PUBLIC_APP_BUILD;

    afterEach(() => {
        process.env.NEXT_PUBLIC_APP_BUILD = original;
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
});
