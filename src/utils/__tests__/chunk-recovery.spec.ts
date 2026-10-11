import { isChunkLoadFailure, isSameOriginChunkAsset } from '../chunk-recovery';

describe('chunk recovery detection', () => {
    it('recognizes JavaScript and CSS chunk failures', () => {
        expect(isChunkLoadFailure({ name: 'ChunkLoadError' })).toBe(true);
        expect(isChunkLoadFailure(new Error('Loading CSS chunk failed'))).toBe(true);
    });

    it('does not treat ordinary API and WebSocket errors as chunk failures', () => {
        expect(isChunkLoadFailure(new Error('WebSocket connection failed'))).toBe(false);
        expect(isChunkLoadFailure(new Error('RateLimit from API'))).toBe(false);
    });

    it('recognizes failed same-origin JavaScript and stylesheet assets', () => {
        const script = document.createElement('script');
        script.src = '/static/js/async/app-chunk.js';

        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = '/static/css/async/auto-signals.css';

        expect(isSameOriginChunkAsset(script)).toBe(true);
        expect(isSameOriginChunkAsset(stylesheet)).toBe(true);
    });

    it('ignores non-stylesheet links and cross-origin assets', () => {
        const icon = document.createElement('link');
        icon.rel = 'icon';
        icon.href = '/static/css/icon.css';

        const externalScript = document.createElement('script');
        externalScript.src = 'https://cdn.example.com/app.js';

        expect(isSameOriginChunkAsset(icon)).toBe(false);
        expect(isSameOriginChunkAsset(externalScript)).toBe(false);
    });
});
