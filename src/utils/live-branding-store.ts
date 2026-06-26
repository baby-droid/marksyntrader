// Tiny reactive pub/sub stores for live App Builder branding (app name + logo).
// The PREVIEW_BRANDING message can arrive before the header (and its logo+name mark)
// has mounted, so the values are stashed here and the LogoMark component subscribes to
// them. The writer (the preview listener in src/preview/) is stripped from standalone
// partner deploys, so these stores stay inert there and LogoMark falls back to the
// build-time logo/name — that's why they live here (always shipped) and not under
// src/preview/ (stripped by the BFF).

type NameListener = (name: string | null) => void;
type LogoListener = (src: string | null) => void;

let previewAppName: string | null = null;
const appNameListeners = new Set<NameListener>();

export function setPreviewAppName(name: string | null): void {
    previewAppName = name;
    appNameListeners.forEach((listener) => listener(name));
}

export function getPreviewAppName(): string | null {
    return previewAppName;
}

export function subscribePreviewAppName(listener: NameListener): () => void {
    appNameListeners.add(listener);
    return () => {
        appNameListeners.delete(listener);
    };
}

let previewLogoSrc: string | null = null;
const logoListeners = new Set<LogoListener>();

export function setPreviewLogo(src: string | null): void {
    previewLogoSrc = src;
    logoListeners.forEach((listener) => listener(src));
}

export function getPreviewLogo(): string | null {
    return previewLogoSrc;
}

export function subscribePreviewLogo(listener: LogoListener): () => void {
    logoListeners.add(listener);
    return () => {
        logoListeners.delete(listener);
    };
}
