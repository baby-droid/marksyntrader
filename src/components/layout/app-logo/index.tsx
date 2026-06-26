// Customizable header logo + app name for white-labeling. Renders on both desktop and
// mobile (next to the hamburger). The logo/name resolution lives in LogoMark: partner
// logo (public/logo.<ext>, written by the BFF at deploy time, or a live data URL pushed
// from the App Builder via PREVIEW_BRANDING) → letter-badge fallback; app name from the
// preview or the resolved deploy/build name.
import { localize } from '@deriv-com/translations';
import { LogoMark } from './LogoMark';
import './app-logo.scss';

export const AppLogo = () => {
    return (
        <a href='/' className='app-header__logo' aria-label={localize('Home')}>
            <LogoMark height={32} />
        </a>
    );
};
