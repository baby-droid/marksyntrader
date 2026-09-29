import { useEffect } from 'react';
import { applyBrandFont, applyPrimaryColor } from '@/utils/apply-branding';
import { setFaviconHref } from '@/utils/document-branding';

type PreviewBrandingPayload = {
    appName?: string;
    primaryColor?: string;
    fontFamily?: string;
    logoUrl?: string;
};

type PreviewMessage = {
    type?: string;
    event?: string;
    payload?: PreviewBrandingPayload;
    branding?: PreviewBrandingPayload;
};

const isPreviewBrandingMessage = (data: unknown): data is PreviewMessage => {
    if (!data || typeof data !== 'object') return false;
    const message = data as PreviewMessage;
    return message.type === 'PREVIEW_BRANDING' || message.event === 'PREVIEW_BRANDING';
};

const applyPreviewBranding = (branding: PreviewBrandingPayload): void => {
    if (branding.appName) document.title = branding.appName;
    if (branding.primaryColor) applyPrimaryColor(branding.primaryColor);
    if (branding.fontFamily) applyBrandFont(branding.fontFamily);
    if (branding.logoUrl) setFaviconHref(branding.logoUrl);
};

export default function PreviewBranding(): null {
    useEffect(() => {
        const onMessage = (event: MessageEvent<PreviewMessage>) => {
            if (!isPreviewBrandingMessage(event.data)) return;
            const branding = event.data.payload ?? event.data.branding;
            if (branding) applyPreviewBranding(branding);
        };

        window.addEventListener('message', onMessage);
        window.parent?.postMessage({ type: 'PREVIEW_READY' }, '*');

        return () => window.removeEventListener('message', onMessage);
    }, []);

    return null;
}