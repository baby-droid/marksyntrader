import React, { useState, useRef, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import SpeedControl from '@/components/speed-control/speed-control';
import { useStore } from '@/hooks/useStore';
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
    const { is_running, onRunButtonClick, onStopButtonClick } = run_panel as any;
    const [collapsed, setCollapsed] = useState(false);

    // Use a ref to track paused so state-batching can never cause a flicker
    const pausedRef = useRef(false);
    const [paused, _setPaused] = useState(false);
    const setPaused = useCallback((v: boolean) => {
        pausedRef.current = v;
        _setPaused(v);
    }, []);

    // Reset paused when bot fully stops (not via pause — check the ref)
    useEffect(() => {
        if (!is_running && !pausedRef.current) {
            _setPaused(false);
            pausedRef.current = false;
        }
    }, [is_running]);

    // Draggable position — load from localStorage, default to right side
    const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
        const saved = loadPos();
        if (saved) return saved;
        return { x: window.innerWidth - 220, y: Math.floor(window.innerHeight * 0.45) };
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

    // Pause: stop the bot but remember we're paused (not fully stopped)
    const handlePause = useCallback(() => {
        setPaused(true);
        onStopButtonClick();
    }, [setPaused, onStopButtonClick]);

    // Resume: clear paused state and restart
    const handleResume = useCallback(() => {
        setPaused(false);
        onRunButtonClick();
    }, [setPaused, onRunButtonClick]);

    const style: React.CSSProperties = pos
        ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
        : { right: 24, bottom: 24 };

    // Derive display state cleanly
    const showPause  = is_running && !paused;
    const showResume = paused && !is_running;
    const showStop   = is_running;

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
                            setPaused(false);
                            onStopButtonClick();
                        } else {
                            setPaused(false);
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
