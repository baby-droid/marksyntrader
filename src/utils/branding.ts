import brandConfig from '../../brand.config.json';

// Candidate logo paths, in priority order. The BFF writes exactly one of these to
// public/ at deploy time; the header mark and favicon probe them in turn (matches the
// Next.js templates' lib/get-logo-src.ts and lib/build-favicon-uri.ts behaviour).
export const LOGO_CANDIDATES = ['/logo.png', '/logo.jpg', '/logo.jpeg', '/logo.webp'];

/**
 * Resolves the partner app name. The BFF injects NEXT_PUBLIC_DERIV_APP_NAME into
 * .env.production at deploy time (the same var the Next.js templates read); falls back
 * to brand.config.json platform.name, then a sensible default. The live App Builder
 * preview name (PREVIEW_BRANDING) is handled separately via the preview-app-name store.
 */
export function getAppName(): string {
    return process.env.NEXT_PUBLIC_DERIV_APP_NAME || brandConfig?.platform?.name || 'Deriv Bot';
}
