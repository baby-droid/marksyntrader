// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React, { useState, useCallback, useRef, useEffect } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { load, save_types } from '@/external/bot-skeleton';
import { botNotification } from '@/components/bot-notification/bot-notification';
import { notification_message } from '@/components/bot-notification/bot-notification-utils';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import { TBlocklyEvents } from 'Types';
import LoadModal from '../../components/load-modal';
import SaveModal from '../dashboard/bot-list/save-modal';
import BotBuilderTourHandler from '../tutorials/dbot-tours/bot-builder-tour';
import QuickStrategy1 from './quick-strategy';
import WorkspaceWrapper from './workspace-wrapper';

const PALE_BLUE = '#7ec8e3';
const PALE_BLUE2 = '#89c4f4';
const PALE_BLUE3 = '#5ab9ea';
const PALE_BLUE4 = '#add8e6';
const PALE_BLUE5 = '#6cb4e4';

const FREE_BOTS_LIST = [
    { id: 'ahmed-syn-even-odd', name: 'Ahmed SYN Even/Odd v1.2', market: 'V25 1s', badge: 'AHMED ★', badgeColor: PALE_BLUE, xmlFile: '/bots/ahmed-syn-even-odd.xml', icon: '🤖' },
    { id: 'over1', name: 'AI Auto SYN Over 1', market: 'V50 1s', badge: 'HOT', badgeColor: PALE_BLUE2, xmlFile: '/bots/over1.xml', icon: '⚡' },
    { id: 'over2', name: 'AI Auto SYN Over 2', market: 'V50 1s', badge: 'HOT', badgeColor: PALE_BLUE3, xmlFile: '/bots/over2.xml', icon: '🎯' },
    { id: 'over3', name: 'AI Auto SYN Over 3', market: 'V50 1s', badge: 'STRONG', badgeColor: PALE_BLUE4, xmlFile: '/bots/over3.xml', icon: '💪' },
    { id: 'under8', name: 'AI Auto SYN Under 8', market: 'V100 1s', badge: 'NEW', badgeColor: PALE_BLUE5, xmlFile: '/bots/under8.xml', icon: '🎰' },
    { id: 'under7', name: 'AI Auto SYN Under 7', market: 'V100 1s', badge: 'NEW', badgeColor: PALE_BLUE2, xmlFile: '/bots/under7.xml', icon: '🔥' },
    { id: 'under6', name: 'AI Auto SYN Under 6', market: 'V50 1s', badge: 'SOLID', badgeColor: PALE_BLUE3, xmlFile: '/bots/under6.xml', icon: '⚔' },
    { id: 'evenodd', name: 'Ahmed SpeedBot Even/Odd v3', market: 'V10 1s', badge: 'AI', badgeColor: PALE_BLUE, xmlFile: '/bots/evenodd.xml', icon: '🤖' },
    { id: 'mrvunja', name: 'Mr Vunja Deriv V2026', market: 'V75 1s', badge: '2026', badgeColor: PALE_BLUE4, xmlFile: '/bots/mrvunja.xml', icon: '💎' },
    { id: 'market-killer-prime-v1', name: 'Market Killer Prime v1', market: 'V25 1s', badge: 'PRIME ★', badgeColor: PALE_BLUE5, xmlFile: '/bots/market-killer-prime-v1.xml', icon: '🎯' },
];

type TFreeBotsPanelProps = {
    onClose: () => void;
    /** Called after XML is loaded into the workspace. shouldRun=true triggers auto-trade. */
    onLoadDone: (shouldRun: boolean) => void;
};

const FreeBotsSidePanel: React.FC<TFreeBotsPanelProps> = ({ onClose, onLoadDone }) => {
    // Single global lock: only one action at a time across all cards
    const [activeBotId, setActiveBotId] = useState<string | null>(null);
    const [actionType, setActionType] = useState<'load' | 'run' | null>(null);
    const [loadedId, setLoadedId] = useState<string | null>(null);

    /** Fetch XML from the bot's URL and load it into the workspace via the official
     *  DBot `load()` pipeline — same path the Load Modal uses — so BlockConversion,
     *  removeLimitedBlocks, asyncClear, and clearWorkspaceAndLoadFromXml all run
     *  in the correct order and the trade engine receives properly initialised blocks. */
    const fetchAndLoad = useCallback(async (bot: typeof FREE_BOTS_LIST[0]): Promise<void> => {
        const response = await fetch(bot.xmlFile);
        if (!response.ok) throw new Error(`Failed to fetch bot XML: ${response.status}`);
        const block_string = await response.text();

        const workspace = (window as any).Blockly?.derivWorkspace;
        if (!workspace) {
            // Workspace not mounted yet — wait up to 10 s
            await new Promise<void>((resolve, reject) => {
                let attempts = 0;
                const poll = setInterval(() => {
                    attempts++;
                    if ((window as any).Blockly?.derivWorkspace) { clearInterval(poll); resolve(); }
                    else if (attempts >= 100) { clearInterval(poll); reject(new Error('Workspace unavailable after 10 s')); }
                }, 100);
            });
        }

        await load({
            block_string,
            drop_event: null,
            file_name: bot.name,
            strategy_id: '',
            from: save_types.LOCAL,
            workspace: (window as any).Blockly.derivWorkspace,
            showIncompatibleStrategyDialog: false,
            show_snackbar: false,
        });
    }, []);

    /** Load only — puts the bot into the builder then closes the panel. */
    const handleLoad = useCallback(async (bot: typeof FREE_BOTS_LIST[0]) => {
        if (activeBotId) return;
        setActiveBotId(bot.id);
        setActionType('load');
        try {
            await fetchAndLoad(bot);
            setLoadedId(bot.id);
            // Show success briefly, then hand control back to parent
            setTimeout(() => {
                setLoadedId(null);
                onLoadDone(false); // false = load only, don't auto-run
            }, 1500);
        } catch (e) {
            console.error('Load bot error', e);
        } finally {
            setActiveBotId(null);
            setActionType(null);
        }
    }, [activeBotId, fetchAndLoad, onLoadDone]);

    /** Load & Run — loads the bot then signals parent to start trading. */
    const handleLoadAndRun = useCallback(async (bot: typeof FREE_BOTS_LIST[0]) => {
        if (activeBotId) return;
        setActiveBotId(bot.id);
        setActionType('run');
        try {
            await fetchAndLoad(bot);
            // Signal parent immediately — parent is responsible for closing
            // panel and triggering the run in the correct order/lifecycle.
            onLoadDone(true); // true = auto-run after panel closes
        } catch (e) {
            console.error('Load & Run bot error', e);
            setActiveBotId(null);
            setActionType(null);
        }
        // Note: we don't reset activeBotId here for the run case because the
        // component will unmount shortly (parent closes it). Resetting would
        // cause a flicker. If load fails the catch above resets it.
    }, [activeBotId, fetchAndLoad, onLoadDone]);

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, width: '300px', height: '100%',
            background: '#11143a', borderRight: '1.5px solid rgba(99,102,241,0.35)',
            zIndex: 20, display: 'flex', flexDirection: 'column', boxShadow: '6px 0 24px rgba(0,0,0,0.5)',
        }}>
            <div style={{
                padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d0f2e',
            }}>
                <span style={{ color: '#c7d2fe', fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em' }}>📥 FREE BOTS LIBRARY</span>
                <button onClick={onClose} style={{
                    background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer',
                    fontSize: '18px', lineHeight: 1, padding: '2px 6px', borderRadius: '4px',
                }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {FREE_BOTS_LIST.map(bot => {
                    const anyBusy  = activeBotId !== null;
                    const isThis   = activeBotId === bot.id;
                    const isDone   = loadedId === bot.id;
                    const isLoading  = isThis && actionType === 'load';
                    const isStarting = isThis && actionType === 'run';
                    return (
                        <div key={bot.id} style={{
                            background: isDone ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${isDone ? 'rgba(34,197,94,0.5)' : 'rgba(99,102,241,0.18)'}`,
                            borderRadius: '10px', padding: '11px 13px', marginBottom: '7px', transition: 'all 0.2s',
                        }}>
                            {/* Bot info row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '18px' }}>{bot.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: '#e0e7ff', fontSize: '12px', fontWeight: 600, lineHeight: 1.3, marginBottom: '2px' }}>{bot.name}</div>
                                    <div style={{ color: '#6b7280', fontSize: '11px' }}>{bot.market}</div>
                                </div>
                                <span style={{
                                    background: bot.badgeColor, color: '#fff', fontSize: '9px', fontWeight: 700,
                                    padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0,
                                }}>{bot.badge}</span>
                            </div>

                            {/* Load into Builder */}
                            <button
                                onClick={() => handleLoad(bot)}
                                disabled={anyBusy || isDone}
                                style={{
                                    width: '100%', padding: '6px', borderRadius: '7px', border: 'none',
                                    cursor: anyBusy || isDone ? 'not-allowed' : 'pointer',
                                    background: isDone ? '#16a34a' : 'rgba(99,102,241,0.85)',
                                    color: '#fff', fontSize: '11px', fontWeight: 600, transition: 'all 0.15s',
                                    opacity: anyBusy && !isThis ? 0.4 : isLoading ? 0.7 : 1,
                                    marginBottom: '5px',
                                }}
                            >
                                {isLoading ? '⏳ Loading...' : isDone ? '✅ Loaded!' : '📥 Load into Builder'}
                            </button>

                            {/* Load & Run */}
                            <button
                                onClick={() => handleLoadAndRun(bot)}
                                disabled={anyBusy}
                                style={{
                                    width: '100%', padding: '6px', borderRadius: '7px', border: 'none',
                                    cursor: anyBusy ? 'not-allowed' : 'pointer',
                                    background: isStarting
                                        ? 'linear-gradient(90deg,#16a34a,#15803d)'
                                        : 'linear-gradient(90deg,#f59e0b,#d97706)',
                                    color: '#fff', fontSize: '11px', fontWeight: 700, transition: 'all 0.15s',
                                    opacity: anyBusy && !isThis ? 0.4 : isStarting ? 0.8 : 1,
                                    boxShadow: anyBusy ? 'none' : '0 0 8px rgba(245,158,11,0.5)',
                                }}
                            >
                                {isStarting ? '⏳ Loading bot...' : '▶ Load & Run'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const BotBuilder = observer(() => {
    const { dashboard, app, run_panel, toolbar, quick_strategy, blockly_store } = useStore();
    const { active_tab, active_tour, is_preview_on_popup } = dashboard;
    const { is_open } = quick_strategy;
    const { is_running } = run_panel;
    const { is_loading } = blockly_store;
    const is_blockly_listener_registered = React.useRef(false);
    const is_blockly_delete_listener_registered = React.useRef(false);
    const { isDesktop } = useDevice();
    const { onMount, onUnmount } = app;
    const el_ref = React.useRef<HTMLInputElement | null>(null);

    // TODO: fix
    // const isMounted = useIsMounted();
    // const { data: remote_config_data } = useRemoteConfig(isMounted());
    let deleted_block_id: null | string = null;

    React.useEffect(() => {
        onMount();
        return () => onUnmount();
    }, [onMount, onUnmount]);

    React.useEffect(() => {
        const workspace = window.Blockly?.derivWorkspace;
        if (workspace && is_running && !is_blockly_listener_registered.current) {
            is_blockly_listener_registered.current = true;
            workspace.addChangeListener(handleBlockChangeOnBotRun);
        } else {
            removeBlockChangeListener();
        }

        return () => {
            if (workspace && is_blockly_listener_registered.current) {
                removeBlockChangeListener();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_running]);

    const handleBlockChangeOnBotRun = (e: Event) => {
        const { is_reset_button_clicked } = toolbar;
        if (e.type !== 'selected' && !is_reset_button_clicked) {
            botNotification(notification_message().workspace_change);
            removeBlockChangeListener();
        } else if (is_reset_button_clicked) {
            removeBlockChangeListener();
        }
    };

    const removeBlockChangeListener = () => {
        is_blockly_listener_registered.current = false;
        window.Blockly?.derivWorkspace?.removeChangeListener(handleBlockChangeOnBotRun);
    };
    React.useEffect(() => {
        const workspace = window.Blockly?.derivWorkspace;
        if (workspace && !is_blockly_delete_listener_registered.current) {
            is_blockly_delete_listener_registered.current = true;
            workspace.addChangeListener(handleBlockDelete);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_loading]);

    const handleBlockDelete = (e: TBlocklyEvents) => {
        const { is_reset_button_clicked, setResetButtonState } = toolbar;
        if (e.type === 'undo') {
            deleted_block_id = null;
            return;
        }
        if (e.type === 'delete' && !is_reset_button_clicked) {
            deleted_block_id = e.blockId;
        }
        if (e.type === 'selected' && deleted_block_id === e.oldElementId) {
            handleBlockDeleteNotification();
            deleted_block_id = null;
        }
        if (
            e.type === 'change' &&
            e.name === 'AMOUNT_LIMITS' &&
            e.newValue === '(min: 0.35 - max: 50000)' &&
            is_reset_button_clicked
        ) {
            setResetButtonState(false);
        }
    };

    const handleBlockDeleteNotification = () => {
        botNotification(notification_message().block_delete, {
            label: localize('Undo'),
            onClick: closeToast => {
                window.Blockly.derivWorkspace.undo();
                closeToast?.();
            },
        });
    };

    const [showFreeBots, setShowFreeBots] = useState(false);
    // When true, fire onRunButtonClick as soon as the panel finishes unmounting
    const pendingAutoRun = React.useRef(false);

    // ── Draggable Free Bots button ──
    const FREE_BOTS_POS_KEY = 'free_bots_btn_pos_v2';
    const getInitialFreeBotPos = () => {
        try {
            const saved = localStorage.getItem(FREE_BOTS_POS_KEY);
            if (saved) {
                const p = JSON.parse(saved);
                if (typeof p.x === 'number' && typeof p.y === 'number') return p;
            }
        } catch { /* ignore */ }
        // Default: middle-left
        return { x: 12, y: Math.max(60, window.innerHeight / 2 - 20) };
    };
    const [freeBotPos, setFreeBotPos] = useState(getInitialFreeBotPos);
    const freeBotDragging = useRef(false);
    const freeBotWasDragged = useRef(false);
    const freeBotOffset = useRef({ x: 0, y: 0 });
    const freeBotBtnRef = useRef<HTMLButtonElement | null>(null);

    const onFreeBotPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        freeBotDragging.current = true;
        freeBotWasDragged.current = false;
        freeBotOffset.current = { x: e.clientX - freeBotPos.x, y: e.clientY - freeBotPos.y };
        // Use currentTarget (the button) not target (could be icon/text inside)
        e.currentTarget.setPointerCapture?.(e.pointerId);
    }, [freeBotPos]);

    const onFreeBotPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        if (!freeBotDragging.current) return;
        const dx = e.clientX - freeBotOffset.current.x - freeBotPos.x;
        const dy = e.clientY - freeBotOffset.current.y - freeBotPos.y;
        if (!freeBotWasDragged.current && Math.hypot(dx, dy) < 4) return;
        freeBotWasDragged.current = true;
        const btn = freeBotBtnRef.current;
        const w = btn?.offsetWidth ?? 110;
        const h = btn?.offsetHeight ?? 34;
        const x = Math.max(4, Math.min(window.innerWidth - w - 4, e.clientX - freeBotOffset.current.x));
        const y = Math.max(4, Math.min(window.innerHeight - h - 4, e.clientY - freeBotOffset.current.y));
        setFreeBotPos({ x, y });
    }, [freeBotPos]);

    const onFreeBotPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        freeBotDragging.current = false;
        if (freeBotWasDragged.current) {
            setFreeBotPos(p => {
                try { localStorage.setItem(FREE_BOTS_POS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
                return p;
            });
            // Suppress the click that follows drag
            const btn = freeBotBtnRef.current;
            if (btn) {
                const suppress = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
                btn.addEventListener('click', suppress, { capture: true, once: true });
            }
        }
    }, []);

    // After the panel fully unmounts (showFreeBots flips to false), trigger the run.
    // Using double requestAnimationFrame so Blockly has had its own paint cycle to
    // finalise block layout before shouldRunBot / generateCode execute.
    React.useEffect(() => {
        if (!showFreeBots && pendingAutoRun.current) {
            pendingAutoRun.current = false;
            // Skip if a bot is already running
            if (run_panel.is_running) return;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    run_panel.onRunButtonClick();
                });
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showFreeBots]);

    /** Called by FreeBotsSidePanel once XML is loaded. */
    const handleBotLoadDone = useCallback((shouldRun: boolean) => {
        if (shouldRun) {
            pendingAutoRun.current = true;
        }
        setShowFreeBots(false); // unmount panel → triggers the useEffect above
    }, []);

    return (
        <>
            <div
                className={classNames('bot-builder', {
                    'bot-builder--active': active_tab === 1 && !is_preview_on_popup,
                    'bot-builder--inactive': is_preview_on_popup,
                    'bot-builder--tour-active': active_tour,
                })}
            >
                <div id='scratch_div' ref={el_ref}>
                    <WorkspaceWrapper />
                </div>

                {/* Free Bots toggle button — draggable, position persisted, hidden while panel is open */}
                {active_tab === 1 && !showFreeBots && (
                    <button
                        ref={freeBotBtnRef}
                        onClick={() => setShowFreeBots(true)}
                        onPointerDown={onFreeBotPointerDown}
                        onPointerMove={onFreeBotPointerMove}
                        onPointerUp={onFreeBotPointerUp}
                        onPointerCancel={onFreeBotPointerUp}
                        title='Free Bots Library (drag to move)'
                        style={{
                            position: 'fixed',
                            left: freeBotPos.x,
                            top: freeBotPos.y,
                            zIndex: 120,
                            background: 'rgba(99,102,241,0.92)',
                            border: '1.5px solid rgba(129,140,248,0.5)',
                            borderRadius: '8px',
                            color: '#fff', fontSize: '12px', fontWeight: 700, padding: '7px 13px',
                            cursor: 'grab', touchAction: 'none',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            userSelect: 'none',
                        }}
                    >
                        📥 <span>Free Bots</span>
                    </button>
                )}

                {/* Free Bots side panel */}
                {active_tab === 1 && showFreeBots && (
                    <FreeBotsSidePanel
                        onClose={() => setShowFreeBots(false)}
                        onLoadDone={handleBotLoadDone}
                    />
                )}
            </div>
            {active_tab === 1 && <BotBuilderTourHandler is_mobile={!isDesktop} />}
            {/* removed this outside from toolbar becuase it needs to loaded seperately without dependency */}
            <LoadModal />
            <SaveModal />
            {is_open && <QuickStrategy1 />}
        </>
    );
});

export default BotBuilder;
