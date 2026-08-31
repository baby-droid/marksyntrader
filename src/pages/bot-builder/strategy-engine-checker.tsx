import React from 'react';

export type StrategyCheck = {
    botName: string;
    xmlBlocks: number;
    sharedChecks: Array<{ id: string; ok: boolean; file: string }>;
    updatedAt: string;
};

type Props = {
    check: StrategyCheck | null;
};

/**
 * Small, persistent status card for built-in strategy loads. This is deliberately
 * independent from Blockly so a malformed or incomplete import is visible even
 * when the workspace has already painted.
 */
const StrategyEngineChecker: React.FC<Props> = ({ check }) => {
    if (!check) return null;

    const allSharedBlocksReady = check.sharedChecks.every(item => item.ok);
    const isReady = check.xmlBlocks > 0 && allSharedBlocksReady;

    return (
        <aside
            aria-live='polite'
            style={{
                position: 'fixed',
                right: 16,
                bottom: 16,
                width: 280,
                zIndex: 140,
                color: '#e0e7ff',
                background: 'linear-gradient(145deg, rgba(15,23,42,.97), rgba(30,27,75,.97))',
                border: `1px solid ${isReady ? 'rgba(52,211,153,.55)' : 'rgba(248,113,113,.65)'}`,
                borderRadius: 10,
                boxShadow: '0 10px 30px rgba(0,0,0,.35)',
                padding: '12px 14px',
                fontSize: 11,
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <strong style={{ letterSpacing: '.04em', fontSize: 12 }}>STRATEGY ENGINE CHECKER</strong>
                <span style={{ color: isReady ? '#34d399' : '#f87171', fontWeight: 800 }}>
                    {isReady ? 'READY' : 'CHECK'}
                </span>
            </div>
            <div style={{ marginTop: 8, color: '#c7d2fe', fontWeight: 700 }}>{check.botName}</div>
            <div style={{ marginTop: 7, display: 'grid', gap: 4, color: '#a5b4fc' }}>
                <span>{isReady ? '✓' : '✕'} Executable Blockly blocks: {check.xmlBlocks}</span>
                {check.sharedChecks.map(item => (
                    <span key={item.id}>
                        {item.ok ? '✓' : '✕'} Shared block: {item.id}
                    </span>
                ))}
            </div>
            <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid rgba(165,180,252,.18)', color: '#94a3b8' }}>
                <div>Latest strategy update</div>
                <div style={{ color: '#e0e7ff', marginTop: 3 }}>{check.updatedAt}</div>
                <button
                    type='button'
                    onClick={() => window.alert(`${check.botName}\n${isReady ? 'All checks passed.' : 'One or more checks failed.'}`)}
                    style={{
                        marginTop: 8,
                        background: 'transparent',
                        border: '1px solid rgba(165,180,252,.35)',
                        color: '#c7d2fe',
                        borderRadius: 5,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: 10,
                    }}
                >
                    Full log
                </button>
            </div>
        </aside>
    );
};

export default StrategyEngineChecker;