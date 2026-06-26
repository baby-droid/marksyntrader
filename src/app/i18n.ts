import { initializeI18n } from '@deriv-com/translations';

// English-only build: the language switcher is disabled (brand.config footer
// enable_language_settings=false) and no translation JSONs ship with the bot.
const i18nInstance = initializeI18n({ cdnUrl: '' });

// The OTA backend in @deriv-com/translations unconditionally fetches
// `<cdnUrl>/translations/<lng>.json` for the active language — cdnUrl '' just makes
// that resolve to `/translations/en.json`, which 404s on both the App Builder
// preview (served under /bot/preview) and standalone partner deploys, since no
// translation JSON ships in either build. The 404 is swallowed (EN falls back to
// the inline i18n_default_text), but the browser still logs the failed request.
//
// Seeding an empty EN bundle marks EN as already loaded, so i18next's connector
// skips the backend `read` for it and the fetch never happens. This is synchronous
// while i18next defers loadResources to a setTimeout, so the bundle is in place
// before the load runs. EN renders from the inline i18n_default_text either way.
i18nInstance.addResourceBundle('EN', 'translation', {});

export default i18nInstance;
