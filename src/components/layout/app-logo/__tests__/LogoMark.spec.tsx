import { fireEvent, render, screen } from '@testing-library/react';
import { LogoMark } from '../LogoMark';

// No NEXT_PUBLIC_DERIV_APP_NAME / preview name in the test env, so getAppName()
// resolves to brand.config.json platform.name ("Deriv Trading Bot").
describe('LogoMark', () => {
    const originalAppBuild = process.env.NEXT_PUBLIC_APP_BUILD;

    afterEach(() => {
        process.env.NEXT_PUBLIC_APP_BUILD = originalAppBuild;
    });

    it('renders the resolved app name', () => {
        render(<LogoMark />);
        expect(screen.getByText('Deriv Trading Bot')).toBeInTheDocument();
    });

    it('renders the logo image (first candidate) by default', () => {
        render(<LogoMark />);
        expect(screen.getByRole('img')).toHaveAttribute('src', '/logo.png');
    });

    it('falls back to the letter badge after every logo candidate fails', () => {
        render(<LogoMark />);
        // Candidates: /logo.png, /logo.jpg, /logo.jpeg, /logo.webp — error through all.
        for (let i = 0; i < 4; i++) {
            const img = screen.queryByRole('img');
            if (!img) break;
            fireEvent.error(img);
        }
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        // Letter badge shows the first letter of the app name.
        expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('skips logo file probing in the preview build and renders the letter badge', () => {
        // The static preview build (NEXT_PUBLIC_APP_BUILD=true) ships no public/logo.*; the
        // live App Builder logo arrives as a data URL via PREVIEW_BRANDING. With no live logo
        // yet, there should be no <img> probe (which would 404) — only the badge fallback.
        process.env.NEXT_PUBLIC_APP_BUILD = 'true';
        render(<LogoMark />);
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.getByText('D')).toBeInTheDocument();
    });
});
