// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React, { useState, useCallback } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
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

const FREE_BOTS_LIST = [
    { id: 'ahmed-syn-even-odd', name: 'Ahmed SYN Even/Odd v1.2', market: 'V25 1s', badge: 'AHMED ★', badgeColor: '#00ff88', xmlFile: '/bots/ahmed-syn-even-odd.xml', icon: '🤖' },
    { id: 'over1', name: 'AI Auto SYN Over 1', market: 'V50 1s', badge: 'HOT', badgeColor: '#f44336', xmlFile: '/bots/over1.xml', icon: '⚡' },
    { id: 'over2', name: 'AI Auto SYN Over 2', market: 'V50 1s', badge: 'HOT', badgeColor: '#f44336', xmlFile: '/bots/over2.xml', icon: '🎯' },
    { id: 'over3', name: 'AI Auto SYN Over 3', market: 'V50 1s', badge: 'STRONG', badgeColor: '#22a36c', xmlFile: '/bots/over3.xml', icon: '💪' },
    { id: 'under8', name: 'AI Auto SYN Under 8', market: 'V100 1s', badge: 'NEW', badgeColor: '#4e7cf5', xmlFile: '/bots/under8.xml', icon: '🎰' },
    { id: 'under7', name: 'AI Auto SYN Under 7', market: 'V100 1s', badge: 'NEW', badgeColor: '#4e7cf5', xmlFile: '/bots/under7.xml', icon: '🔥' },
    { id: 'under6', name: 'AI Auto SYN Under 6', market: 'V50 1s', badge: 'SOLID', badgeColor: '#f5c842', xmlFile: '/bots/under6.xml', icon: '⚔' },
    { id: 'evenodd', name: 'Ahmed SpeedBot Even/Odd v3', market: 'V10 1s', badge: 'AI', badgeColor: '#a855f7', xmlFile: '/bots/evenodd.xml', icon: '🤖' },
    { id: 'mrvunja', name: 'Mr Vunja Deriv V2026', market: 'V75 1s', badge: '2026', badgeColor: '#ff6b00', xmlFile: '/bots/mrvunja.xml', icon: '💎' },
];

const FreeBotsSidePanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [loadedId, setLoadedId] = useState<string | null>(null);

    const loadXmlNow = useCallback((xml: string) => {
        const B = (window as any).Blockly;
        if (!B || !B.derivWorkspace) return false;
        try {
            const dom = B.Xml.textToDom(xml);
            B.Events.setEnabled(false);
            B.derivWorkspace.clear();
            B.Xml.domToWorkspace(dom, B.derivWorkspace);
            B.Events.setEnabled(true);
            B.svgResize?.(B.derivWorkspace);
            B.derivWorkspace.scrollCenter?.();
            return true;
        } catch (err) {
            console.error('domToWorkspace error', err);
            return false;
        }
    }, []);

    const handleLoad = useCallback(async (bot: typeof FREE_BOTS_LIST[0]) => {
        setLoadingId(bot.id);
        try {
            const response = await fetch(bot.xmlFile);
            if (!response.ok) throw new Error('Failed to fetch bot XML');
            const xml = await response.text();
            (window as any).__pendingBotXml = xml;
            (window as any).__pendingBotName = bot.name;

            // Try immediately; poll until workspace is ready (max 8s)
            if (!loadXmlNow(xml)) {
                let attempts = 0;
                const poll = setInterval(() => {
                    attempts++;
                    if (loadXmlNow(xml) || attempts >= 80) {
                        clearInterval(poll);
                        (window as any).__pendingBotXml = null;
                    }
                }, 100);
            } else {
                (window as any).__pendingBotXml = null;
            }

            setLoadedId(bot.id);
            setTimeout(() => { setLoadedId(null); onClose(); }, 1800);
        } catch (e) {
            console.error('Load bot error', e);
        } finally {
            setLoadingId(null);
        }
    }, [onClose, loadXmlNow]);

    return (
        <div style={{
            position: 'absolute', top: 0, right: 0, width: '300px', height: '100%',
            background: '#11143a', borderLeft: '1.5px solid rgba(99,102,241,0.35)',
            zIndex: 20, display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 24px rgba(0,0,0,0.5)',
        }}>
            <div style={{
                padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d0f2e',
            }}>
                <span style={{ color: '#c7d2fe', fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em' }}>📥 FREE BOTS LIBRARY</span>
                <button onClick={onClose} style={{
                    background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 6px', borderRadius: '4px',
                }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {FREE_BOTS_LIST.map(bot => (
                    <div key={bot.id} style={{
                        background: loadedId === bot.id ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${loadedId === bot.id ? 'rgba(34,197,94,0.5)' : 'rgba(99,102,241,0.18)'}`,
                        borderRadius: '10px', padding: '11px 13px', marginBottom: '7px',
                        transition: 'all 0.2s',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
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
                        <button
                            onClick={() => handleLoad(bot)}
                            disabled={loadingId === bot.id || loadedId === bot.id}
                            style={{
                                width: '100%', padding: '7px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                                background: loadedId === bot.id ? '#16a34a' : 'rgba(99,102,241,0.85)',
                                color: '#fff', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                                opacity: loadingId === bot.id ? 0.7 : 1,
                            }}
                        >
                            {loadingId === bot.id ? '⏳ Loading...' : loadedId === bot.id ? '✅ Loaded!' : '▶ Load into Builder'}
                        </button>
                    </div>
                ))}
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

                {/* Free Bots toggle button */}
                {active_tab === 1 && (
                    <button
                        onClick={() => setShowFreeBots(v => !v)}
                        title='Free Bots Library'
                        style={{
                            position: 'absolute', top: '8px', right: showFreeBots ? '308px' : '8px',
                            zIndex: 25, background: showFreeBots ? '#4f46e5' : 'rgba(99,102,241,0.88)',
                            border: '1.5px solid rgba(129,140,248,0.5)', borderRadius: '8px',
                            color: '#fff', fontSize: '12px', fontWeight: 700, padding: '7px 13px',
                            cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        📥 <span>Free Bots</span>
                    </button>
                )}

                {/* Free Bots side panel */}
                {active_tab === 1 && showFreeBots && (
                    <FreeBotsSidePanel onClose={() => setShowFreeBots(false)} />
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
