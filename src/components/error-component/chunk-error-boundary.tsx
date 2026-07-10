/**
 * ChunkErrorPage — errorElement for React Router routes.
 *
 * When Rsbuild splits `@deriv/quill-icons`, `@deriv-com/smartcharts-champion`,
 * or any other heavy package into its own async chunk, and that chunk fails to
 * load (stale URL after a server restart, network blip, cache mismatch), the
 * error bubbles past Suspense to React Router's route error handler.
 *
 * This component:
 *  1. Detects ChunkLoadError / failed dynamic import errors automatically.
 *  2. On first detection: sets a one-shot sessionStorage flag and reloads so
 *     the browser fetches fresh chunk URLs from the live server.
 *  3. If the reload doesn't fix it (second visit with the flag set): shows a
 *     friendly "Reload App" button instead of looping infinitely.
 *  4. For non-chunk errors: shows the error message with a manual reload button.
 */

import React, { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';

const RELOAD_FLAG = 'chunk_reload_attempted';

function isChunkError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    return (
        err.name === 'ChunkLoadError' ||
        /loading chunk/i.test(err.message) ||
        /failed to fetch dynamically imported module/i.test(err.message) ||
        /error loading dynamically imported module/i.test(err.message) ||
        /loading css chunk/i.test(err.message)
    );
}

const ChunkErrorPage: React.FC = () => {
    const error = useRouteError();
    const chunk = isChunkError(error);

    useEffect(() => {
        if (!chunk) return;
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
            // First occurrence — reload once with a fresh URL cache-bust
            sessionStorage.setItem(RELOAD_FLAG, '1');
            window.location.reload();
        }
        // If flag already set, fall through to the manual button below
    }, [chunk]);

    // Clear the reload flag once the app loads correctly
    // (this component only mounts on error, so clearing it here is safe)
    // — it's cleared on the next successful load in AppRoot via a separate effect

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        background: '#0d1117',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
    };

    const btnStyle: React.CSSProperties = {
        marginTop: '8px',
        padding: '10px 28px',
        border: 'none',
        borderRadius: '8px',
        background: '#2563eb',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 700,
        transition: 'background 0.15s',
    };

    if (chunk) {
        const alreadyTried = sessionStorage.getItem(RELOAD_FLAG);
        return (
            <div style={containerStyle}>
                <div style={{ fontSize: '2.5rem' }}>🔄</div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                    {alreadyTried ? 'Still having trouble loading' : 'Reloading app…'}
                </h2>
                <p style={{ color: '#8aa0b8', margin: 0, fontSize: '0.9rem', textAlign: 'center', maxWidth: 360 }}>
                    {alreadyTried
                        ? 'A resource failed to load after restart. Click below to try again.'
                        : 'A new version was detected. Fetching fresh resources…'}
                </p>
                {alreadyTried && (
                    <button
                        style={btnStyle}
                        onClick={() => {
                            sessionStorage.removeItem(RELOAD_FLAG);
                            window.location.reload();
                        }}
                    >
                        Reload App
                    </button>
                )}
            </div>
        );
    }

    // Generic (non-chunk) route error
    const msg = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    return (
        <div style={containerStyle}>
            <div style={{ fontSize: '2.5rem' }}>⚠️</div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Something went wrong</h2>
            <p style={{ color: '#8aa0b8', margin: 0, fontSize: '0.9rem', maxWidth: 400, textAlign: 'center' }}>
                {msg}
            </p>
            <button style={btnStyle} onClick={() => window.location.reload()}>
                Reload App
            </button>
        </div>
    );
};

export default ChunkErrorPage;
