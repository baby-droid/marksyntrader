// Pure, build-time check: Google Drive is configured only when all three
// credentials are present. rsbuild's `define` injects the literal string
// 'undefined' when an env var is unset, so guard against both empty and
// 'undefined'. Single source of truth reused by the store and by static
// help-content modules (tutorials/tour) that have no store access.
const isSet = (value: string | undefined) => !!value && value !== 'undefined';

export const isGoogleDriveConfigured = (): boolean =>
    isSet(process.env.GD_CLIENT_ID) && isSet(process.env.GD_APP_ID) && isSet(process.env.GD_API_KEY);
