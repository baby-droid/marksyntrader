describe('applyPrimaryColorFromConfig', () => {
    afterEach(() => {
        // The CSS vars are set on the shared jsdom <html>; clear between cases.
        document.documentElement.removeAttribute('style');
        jest.resetModules();
    });

    it('applies brand.config.json colors.primary to the brand CSS vars', () => {
        jest.isolateModules(() => {
            jest.doMock('../../../brand.config.json', () => ({ colors: { primary: '#ff00ff' } }));
            const { applyPrimaryColorFromConfig } = require('../document-branding');

            applyPrimaryColorFromConfig();

            const root = document.documentElement;
            // applyPrimaryColor() sets both the semantic name and the legacy alias the UI reads.
            expect(root.style.getPropertyValue('--brand-primary')).toBe('#ff00ff');
            expect(root.style.getPropertyValue('--brand-red-coral')).toBe('#ff00ff');
        });
    });

    it('is a no-op when colors.primary is absent', () => {
        jest.isolateModules(() => {
            jest.doMock('../../../brand.config.json', () => ({ colors: {} }));
            const { applyPrimaryColorFromConfig } = require('../document-branding');

            applyPrimaryColorFromConfig();

            expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('');
        });
    });
});

describe('applyFaviconFromLogo', () => {
    const RealImage = global.Image;
    let imageProbeCount = 0;

    beforeEach(() => {
        imageProbeCount = 0;
        // Minimal Image stub that counts probe attempts (each candidate sets `src`).
        // @ts-expect-error - partial stub is enough for the probing path under test.
        global.Image = class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_value: string) {
                imageProbeCount += 1;
            }
        };
    });

    afterEach(() => {
        global.Image = RealImage;
        jest.resetModules();
    });

    it('probes logo candidates in standalone (non-preview) builds', () => {
        jest.isolateModules(() => {
            jest.doMock('../is-preview-mode', () => ({ isPreviewMode: () => false }));
            const { applyFaviconFromLogo } = require('../document-branding');

            applyFaviconFromLogo();

            expect(imageProbeCount).toBeGreaterThan(0);
        });
    });

    it('sets the letter-badge favicon without probing in the preview build', () => {
        jest.isolateModules(() => {
            jest.doMock('../is-preview-mode', () => ({ isPreviewMode: () => true }));
            jest.doMock('../../../brand.config.json', () => ({
                platform: { name: 'Quokka' },
                colors: { primary: '#abcdef' },
            }));
            const { applyFaviconFromLogo } = require('../document-branding');

            applyFaviconFromLogo();

            // The preview build ships no public/logo.*, so it must not probe files…
            expect(imageProbeCount).toBe(0);
            // …but it must still show the letter badge rather than the deriv default.
            const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
            expect(link?.href).toMatch(/^data:image\/svg\+xml;base64,/);
            expect(atob(link!.href.replace('data:image/svg+xml;base64,', ''))).toContain('>Q</text>');
        });
    });

    it('falls back to a letter-badge SVG favicon when no logo candidate loads', () => {
        // Stub Image so every probed candidate fails — drives the chain to exhaustion.
        // @ts-expect-error - partial stub is enough for the failing-probe path under test.
        global.Image = class {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_value: string) {
                this.onerror?.();
            }
        };

        jest.isolateModules(() => {
            jest.doMock('../is-preview-mode', () => ({ isPreviewMode: () => false }));
            jest.doMock('../../../brand.config.json', () => ({
                platform: { name: 'Zephyr' },
                colors: { primary: '#3b82f6' },
            }));
            const { applyFaviconFromLogo } = require('../document-branding');

            applyFaviconFromLogo();

            const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
            expect(link?.href).toMatch(/^data:image\/svg\+xml;base64,/);
            const svg = atob(link!.href.replace('data:image/svg+xml;base64,', ''));
            expect(svg).toContain('>Z</text>');
            expect(svg).toContain('#3b82f6');
        });
    });
});
