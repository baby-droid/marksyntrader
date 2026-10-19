import React, { useState, useRef, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import SpeedControl from '@/components/speed-control/speed-control';
import { useStore } from '@/hooks/useStore';
import { useDevice } from '@deriv-com/ui';
import './floating-run-button.scss';

const STORAGE_KEY = 'floating_run_btn_pos';

function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
}

function loadPos(): { x: number; y: number } | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch {}
    return null;
}

function savePos(pos: { x: number; y: number }) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch {}
}

const FloatingRunButton: React.FC = observer(() => {
    const { run_panel } = useStore();
    const { isDesktop } = useDevice();
    const {
        is_running,
        is_paused: paused,
        onRunButtonClick,
        onStopButtonClick,
        onPauseButtonClick,
        onResumeButtonClick,
    } = run_panel as any;
    const [collapsed, setCollapsed] = useState(false);

    // Draggable position — load from localStorage, default to middle-left
    const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
        const saved = loadPos();
        if (saved) return saved;
        return { x: 20, y: Math.floor(window.innerHeight * 0.45) };
    });
    const dragRef = useRef<{
        startX: number; startY: number;
        origX: number; origY: number;
        dragging: boolean;
    } | null>(null);
    const btnRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (pos) savePos(pos);
    }, [pos]);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const el = btnRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: pos?.x ?? rect.left,
            origY: pos?.y ?? rect.top,
            dragging: false,
        };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        e.stopPropagation();
    }, [pos]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const st = dragRef.current;
        if (!st) return;
        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;
        if (!st.dragging && Math.hypot(dx, dy) < 4) return;
        st.dragging = true;
        const el = btnRef.current;
        const w = el?.offsetWidth ?? 200;
        const h = el?.offsetHeight ?? 60;
        const x = clamp(st.origX + dx, 4, window.innerWidth - w - 4);
        const y = clamp(st.origY + dy, 4, window.innerHeight - h - 4);
        setPos({ x, y });
    }, []);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const st = dragRef.current;
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        dragRef.current = null;
        if (st?.dragging && pos) savePos(pos);
    }, [pos]);

    // Pause: halt the bot engine in place — it stays active (loaded, holding
    // its current stake/martingale state) but stops entering new trades.
    const handlePause = useCallback(() => {
        onPauseButtonClick();
    }, [onPauseButtonClick]);

    // Resume: continue execution exactly where it paused (no restart, no
    // reset of stake/martingale progression).
    const handleResume = useCallback(() => {
        onResumeButtonClick();
    }, [onResumeButtonClick]);

    const style: React.CSSProperties = pos
        ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
        : { left: 20, top: '45vh', right: 'auto', bottom: 'auto' };

    // Derive display state cleanly. The bot stays "running" (loaded, active)
    // while paused — only the interpreter's tick loop is halted, so Stop is
    // always available to fully terminate it.
    const showPause  = is_running && !paused;
    const showResume = is_running && paused;
    const showStop   = is_running;

    // The mobile run bar owns the idle/run affordance on supported pages.
    // Keeping this floating surface hidden while idle prevents the old
    // "○ Bot Idle" pill from covering page content on every mobile tab.
    if (!isDesktop && !is_running) return null;

    return (
        <div
            ref={btnRef}
            className={`floating-run-btn ${collapsed ? 'collapsed' : ''} ${paused ? 'paused' : ''}`}
            style={style}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <div className='floating-run-btn__drag-handle' title='Drag to move'>⠿</div>
            {!collapsed && (
                <div className='floating-run-btn__info'>
                    <span className={`floating-run-btn__status ${is_running ? 'running' : paused ? 'paused' : 'idle'}`}>
                        {is_running ? '● BOT RUNNING' : paused ? '⏸ PAUSED' : '○ Bot Idle'}
                    </span>
                    <SpeedControl className='floating-run-btn__speed' compact />
                </div>
            )}
            <div className='floating-run-btn__actions'>
                {/* Pause — shown while bot is actively running */}
                {showPause && (
                    <button
                        className='floating-run-btn__btn pause'
                        onClick={e => { e.stopPropagation(); handlePause(); }}
                        title='Pause after current trade'
                    >
                        ⏸
                    </button>
                )}
                {/* Resume — shown while bot is paused and not running */}
                {showResume && (
                    <button
                        className='floating-run-btn__btn resume'
                        onClick={e => { e.stopPropagation(); handleResume(); }}
                        title='Resume bot'
                    >
                        ▶
                    </button>
                )}
                {/* Run / Stop */}
                <button
                    className={`floating-run-btn__btn ${showStop ? 'stop' : 'run'}`}
                    onClick={e => {
                        e.stopPropagation();
                        if (is_running) {
                            onStopButtonClick();
                        } else {
                            onRunButtonClick();
                        }
                    }}
                    title={is_running ? 'Stop bot' : 'Run bot'}
                >
                    {is_running ? '⏹' : '▶'}
                </button>
                <button
                    className='floating-run-btn__collapse'
                    onClick={e => { e.stopPropagation(); setCollapsed(c => !c); }}
                    title={collapsed ? 'Expand' : 'Collapse'}
                >
                    {collapsed ? '◀' : '▶'}
                </button>
            </div>
        </div>
    );
});

export default FloatingRunButton;
