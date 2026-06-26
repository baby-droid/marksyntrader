import { isGoogleDriveConfigured } from '../is-google-drive-configured';

describe('isGoogleDriveConfigured', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('returns true when all three GD credentials are set', () => {
        process.env.GD_CLIENT_ID = 'client';
        process.env.GD_APP_ID = 'app';
        process.env.GD_API_KEY = 'key';
        expect(isGoogleDriveConfigured()).toBe(true);
    });

    it('returns false when any credential is missing', () => {
        process.env.GD_CLIENT_ID = 'client';
        process.env.GD_APP_ID = 'app';
        delete process.env.GD_API_KEY;
        expect(isGoogleDriveConfigured()).toBe(false);
    });

    it("returns false when a credential is the literal string 'undefined' (rsbuild define for unset vars)", () => {
        process.env.GD_CLIENT_ID = 'undefined';
        process.env.GD_APP_ID = 'app';
        process.env.GD_API_KEY = 'key';
        expect(isGoogleDriveConfigured()).toBe(false);
    });

    it('returns false when a credential is an empty string', () => {
        process.env.GD_CLIENT_ID = '';
        process.env.GD_APP_ID = 'app';
        process.env.GD_API_KEY = 'key';
        expect(isGoogleDriveConfigured()).toBe(false);
    });
});
