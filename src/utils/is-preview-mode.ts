/**
 * True when the app is running as the App Builder static preview build
 * (served under /bot/preview inside the App Builder iframe). The preview
 * pipeline sets NEXT_PUBLIC_APP_BUILD=true; standalone partner deploys do not.
 * The pathname check keeps the Replit development preview working when the
 * build-time flag is not injected by the local dev workflow.
 *
 * Used to suppress the onboarding / bot-builder guided tours, which are noise
 * inside the App Builder preview pane.
 */
/**
 * Route/asset base the static preview build is served under. Single source of truth for
 * the runtime side: it matches the rsbuild `assetPrefix` ('/bot/preview/') and the React
 * Router basename. Standalone partner deploys are served at the root, so they do not use it.
 */
export const PREVIEW_BASE_PATH = '/bot/preview';

export const isPreviewMode = (): boolean =>
    process.env.NEXT_PUBLIC_APP_BUILD === 'true' ||
    (typeof window !== 'undefined' &&
        (window.location.pathname === PREVIEW_BASE_PATH ||
            window.location.pathname.startsWith(`${PREVIEW_BASE_PATH}/`)));
