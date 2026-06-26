// Shared logo + app name "mark" rendered in the header (desktop & mobile, next to the
// hamburger) and in the mobile drawer. Logo priority: live App Builder preview data URL
// → public/logo.<png|jpg|jpeg|webp> → letter-badge fallback. The app name comes from the
// live preview, else the resolved deploy/build name (see getAppName).
import { useEffect, useMemo, useState } from 'react';
import {
    getPreviewAppName,
    getPreviewLogo,
    subscribePreviewAppName,
    subscribePreviewLogo,
} from '@/utils/live-branding-store';
import { isPreviewMode } from '@/utils/is-preview-mode';
import { getAppName, LOGO_CANDIDATES } from '../../../utils/branding';

type TLogoMarkProps = {
    height?: number;
};

export const LogoMark = ({ height = 32 }: TLogoMarkProps) => {
    const [previewLogo, setPreviewLogo] = useState<string | null>(getPreviewLogo());
    const [previewAppName, setPreviewAppName] = useState<string | null>(getPreviewAppName());
    const [candidateIndex, setCandidateIndex] = useState(0);

    useEffect(() => subscribePreviewLogo(setPreviewLogo), []);
    useEffect(() => subscribePreviewAppName(setPreviewAppName), []);

    // Preview data URL wins, then the deploy-time public/logo.<ext> candidates. The static
    // preview build ships no public/logo.* (the live App Builder logo arrives as a data URL),
    // so skip the file candidates there to avoid pointless 404 probes — fall back to the badge.
    const candidates = useMemo(() => {
        const fileFallbacks = isPreviewMode() ? [] : LOGO_CANDIDATES;
        return previewLogo ? [previewLogo, ...fileFallbacks] : [...fileFallbacks];
    }, [previewLogo]);

    // Restart probing whenever the candidate list changes (e.g. a new preview logo).
    useEffect(() => setCandidateIndex(0), [candidates]);

    const appName = previewAppName || getAppName();
    const logoSrc = candidateIndex < candidates.length ? candidates[candidateIndex] : null;
    const badgeLetter = appName.trim().charAt(0).toUpperCase() || 'A';

    return (
        <span className='app-header__logo-mark'>
            {logoSrc ? (
                <img
                    data-logo
                    src={logoSrc}
                    alt={appName}
                    className='app-header__logo-img'
                    style={{ height: `${height}px` }}
                    onError={() => setCandidateIndex((index) => index + 1)}
                />
            ) : (
                <span
                    className='app-header__logo-badge'
                    style={{ height: `${height}px`, width: `${height}px` }}
                    aria-hidden='true'
                >
                    {badgeLetter}
                </span>
            )}
            <span className='app-header__logo-text'>{appName}</span>
        </span>
    );
};
