// Record into a plain array, not a jest.fn — the seeding runs once at module
// import time, and jest's `clearMocks: true` would wipe a jest.fn's call log
// before the first test body executes.
const mockBundleCalls: unknown[][] = [];

jest.mock('@deriv-com/translations', () => ({
    initializeI18n: jest.fn(() => ({
        addResourceBundle: (...args: unknown[]) => mockBundleCalls.push(args),
    })),
}));

// Importing the module runs its top-level i18n setup.
import i18nInstance from '../i18n';

describe('bot i18n setup', () => {
    // Regression: the OTA backend in @deriv-com/translations fetches
    // `<cdnUrl>/translations/<lng>.json` for the active language regardless of
    // cdnUrl. With cdnUrl '' that resolved to `/translations/en.json`, which 404'd
    // on both the App Builder preview (served under /bot/preview) and standalone
    // partner deploys (no translation JSON ships in either build). Seeding an empty
    // EN bundle before i18next's deferred loadResources runs makes it treat EN as
    // already loaded, so the backend `read` — and its fetch — never fires.
    it('seeds an empty EN translation bundle so the OTA backend never fetches /translations/en.json', () => {
        expect(mockBundleCalls).toContainEqual(['EN', 'translation', {}]);
    });

    it('exports the initialized i18n instance', () => {
        expect(i18nInstance).toBeDefined();
    });
});
