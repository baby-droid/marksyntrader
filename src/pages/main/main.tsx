// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React, { lazy, Suspense, useEffect, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useLocation, useNavigate } from 'react-router-dom';
import ChunkLoader from '@/components/loader/chunk-loader';
import { generateOAuthURL } from '@/components/shared';
import DesktopWrapper from '@/components/shared_ui/desktop-wrapper';
import Dialog from '@/components/shared_ui/dialog';
import MobileWrapper from '@/components/shared_ui/mobile-wrapper';
import Tabs from '@/components/shared_ui/tabs/tabs';
import TradeTypeConfirmationModal from '@/components/trade-type-confirmation-modal';
import TradingViewModal from '@/components/trading-view-chart/trading-view-modal';
import { DBOT_TABS, TAB_IDS } from '@/constants/bot-contents';
import { api_base, updateWorkspaceName } from '@/external/bot-skeleton';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { isDbotRTL } from '@/external/bot-skeleton/utils/workspace';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import {
    disableUrlParameterApplication,
    enableUrlParameterApplication,
    setupTradeTypeChangeListener,
} from '@/utils/blockly-url-param-handler';
import {
    checkAndShowTradeTypeModal,
    getModalState,
    handleTradeTypeCancel,
    handleTradeTypeConfirm,
    resetUrlParamProcessing,
    setModalStateChangeCallback,
} from '@/utils/trade-type-modal-handler';
import {
    LabelPairedChartLineCaptionRegularIcon,
    LabelPairedObjectsColumnCaptionRegularIcon,
} from '@deriv/quill-icons/LabelPaired';
import { LegacyGuide1pxIcon } from '@deriv/quill-icons/Legacy';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import RunPanel from '../../components/run-panel';
import ChartModal from '../chart/chart-modal';
import Dashboard from '../dashboard';
import RunStrategy from '../dashboard/run-strategy';
import SettingsPanel from '@/components/settings-panel';
import FloatingRunButton from '@/components/floating/FloatingRunButton';
import WhatsAppFloat from '@/components/floating/WhatsAppFloat';
import { copyEngine, mirrorEngine } from '@/utils/copy-trading';
import './main.scss';

const ChartWrapper   = lazy(() => import('../chart/chart-wrapper'));
const Tutorial       = lazy(() => import('../tutorials'));
const FreeBots       = lazy(() => import('../free-bots'));
const DCircles       = lazy(() => import('../dcircles'));
const TradingSoftware = lazy(() => import('../trading-software'));
const SpeedLab       = lazy(() => import('../speed-lab'));
const ProHedge       = lazy(() => import('../hedge-trading'));
const ManualTrader   = lazy(() => import('../manual-trader'));
const CopyTrading    = lazy(() => import('../copy-trading'));
const Reports        = lazy(() => import('../reports'));
const BulkTrade      = lazy(() => import('../bulk-trade'));
const Analysis       = lazy(() => import('../analysis'));
const AhmedLearning  = lazy(() => import('../ahmed-learning'));
const AutoTrades     = lazy(() => import('../auto-trades'));
const ScalperBots    = lazy(() => import('../scalper-bots'));

const AppWrapper = observer(() => {
    const { connectionStatus } = useApiBase();
    const { dashboard, load_modal, run_panel, quick_strategy, summary_card, blockly_store } = useStore();
    const { is_loading } = blockly_store;
    const {
        active_tab,
        active_tour,
        is_chart_modal_visible,
        is_trading_view_modal_visible,
        setActiveTab,
        setWebSocketState,
        setActiveTour,
        setTourDialogVisibility,
    } = dashboard;
    const { dashboard_strategies } = load_modal;
    const {
        is_dialog_open,
        is_drawer_open,
        dialog_options,
        onCancelButtonClick,
        onCloseDialog,
        onOkButtonClick,
        stopBot,
    } = run_panel;
    const { is_open } = quick_strategy;
    const { cancel_button_text, ok_button_text, title, message, dismissable, is_closed_on_cancel } = dialog_options as { [key: string]: string };
    const { clear } = summary_card;
    const { DASHBOARD, BOT_BUILDER } = DBOT_TABS;
    const init_render = React.useRef(true);

    const hash = [
        'dashboard',        // 0
        'ahmed_learning',   // 1
        'free_bots',        // 2
        'ahmed_scalper_bots', // 3
        'dcircles',         // 4
        'speed_lab',        // 5
        'pro_hedge',        // 6
        'chart',            // 7
        'manual_trader',    // 8
        'auto_trades',      // 9
        'copy_trading',     // 10
        'reports',          // 11
        'bulk_trade',       // 12
        'analysis',         // 13
        'tutorial',         // 14
        'trading_software', // 15
    ];

    const { isDesktop } = useDevice();
    const location = useLocation();
    const navigate = useNavigate();
    const [left_tab_shadow, setLeftTabShadow] = useState<boolean>(false);
    const [right_tab_shadow, setRightTabShadow] = useState<boolean>(false);
    const [tradeTypeModalState, setTradeTypeModalState] = useState(getModalState());

    const getTradeTypeModalProps = () => {
        const { tradeTypeData } = tradeTypeModalState;
        return {
            is_visible: tradeTypeModalState.isVisible,
            trade_type_display_name: tradeTypeData?.displayName || '',
            current_trade_type: tradeTypeData?.currentTradeType
                ? `${tradeTypeData.currentTradeType.tradeTypeCategory}/${tradeTypeData.currentTradeType.tradeType}`
                : 'N/A',
            current_trade_type_display_name: tradeTypeData?.currentTradeTypeDisplayName || 'N/A',
            onConfirm: handleTradeTypeConfirm,
            onCancel: handleTradeTypeCancel,
        };
    };

    const is_preview_mode = window.location.pathname.includes('/preview');
    let tab_value: number | string = active_tab;
    const GetHashedValue = (tab: number) => {
        tab_value = location.hash?.split('#')[1];
        if (!tab_value) return is_preview_mode ? BOT_BUILDER : tab;
        return Number(hash.indexOf(String(tab_value)));
    };
    const active_hash_tab = GetHashedValue(active_tab);

    // Register service worker for PWA
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
    }, []);

    // ── Copy-trading: global restore on every page load ────────────────────
    // restoreState() reads localStorage, reconnects follower WebSockets, and
    // auto-restarts the engine if it was running when the page was last closed.
    // This runs regardless of which tab the user lands on, so the engine stays
    // active across page refreshes and tab switches for the full 72-hour session.
    useEffect(() => {
        copyEngine.restoreState().catch(() => {});
        mirrorEngine.restoreState().catch(() => {});
    }, []);

    React.useEffect(() => {
        setModalStateChangeCallback(new_state => { setTradeTypeModalState(new_state); });
    }, [is_loading]);

    React.useEffect(() => { resetUrlParamProcessing(); }, [location.search]);

    React.useEffect(() => {
        const el_dashboard = document.getElementById('id-dbot-dashboard');
        const el_last = document.getElementById('id-tutorial');
        const observerDash = new window.IntersectionObserver(([e]) => { setLeftTabShadow(!e.isIntersecting); }, { root: null, threshold: 0.5 });
        const observerLast = new window.IntersectionObserver(([e]) => { setRightTabShadow(!e.isIntersecting); }, { root: null, threshold: 0.5 });
        if (el_dashboard) observerDash.observe(el_dashboard);
        if (el_last) observerLast.observe(el_last);
        return () => {
            if (el_dashboard) observerDash.unobserve(el_dashboard);
            if (el_last) observerLast.unobserve(el_last);
        };
    });

    React.useEffect(() => {
        if (connectionStatus === CONNECTION_STATUS.OPENED) {
            setWebSocketState(true);
        } else {
            const is_bot_running = document.getElementById('db-animation__stop-button') !== null;
            if (is_bot_running) { clear(); stopBot(); api_base.setIsRunning(false); setWebSocketState(false); }
        }
    }, [clear, connectionStatus, setWebSocketState, stopBot]);

    React.useEffect(() => {
        if (is_open) setTourDialogVisibility(false);
        if (init_render.current) {
            setActiveTab(Number(active_hash_tab));
            if (!isDesktop) handleTabChange(Number(active_hash_tab));
            init_render.current = false;
        } else {
            const currentSearch = window.location.search;
            navigate(`${currentSearch}#${hash[active_tab] || hash[0]}`);
        }
        if (active_tour !== '') setActiveTour('');
        const mainElement = document.querySelector('.main__container');
        if (active_tab === DBOT_TABS.TUTORIAL && !isDesktop) {
            document.body.style.overflow = 'hidden';
            if (mainElement instanceof HTMLElement) mainElement.classList.add('no-scroll');
        } else {
            document.body.style.overflow = '';
            if (mainElement instanceof HTMLElement) mainElement.classList.remove('no-scroll');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active_tab]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (dashboard_strategies.length > 0) { timer = setTimeout(() => { updateWorkspaceName(); }); }
        return () => { if (timer) clearTimeout(timer); };
    }, [dashboard_strategies, active_tab]);

    const handleTabChange = React.useCallback(
        (tab_index: number) => {
            setActiveTab(tab_index);
            const el_id = TAB_IDS[tab_index];
            if (el_id) {
                const el_tab = document.getElementById(el_id);
                setTimeout(() => { el_tab?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); }, 10);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [active_tab]
    );

    const handleLoginGeneration = async () => {
        const oauthUrl = await generateOAuthURL();
        if (oauthUrl) window.location.replace(oauthUrl);
    };

    const tabLoader = (msg: string) => <ChunkLoader message={localize(msg)} />;

    const mkIcon = (svg: React.ReactNode, text: string) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
            {svg}<span>{text}</span>
        </span>
    );

    return (
        <React.Fragment>
            <div className='main'>
                {/* Settings Panel */}
                <div style={{ position: 'fixed', bottom: '7rem', right: '1.2rem', zIndex: 500 }}>
                    <SettingsPanel onTabChange={handleTabChange} currentTab={active_tab} />
                </div>

                <div className={classNames('main__container', {
                    'main__container--active': active_tour && active_tab === DASHBOARD && !isDesktop,
                })}>
                    <div>
                        {!isDesktop && left_tab_shadow && <span className='tabs-shadow tabs-shadow--left' />}
                        <Tabs active_index={active_tab} className='main__tabs main__tabs--drawer-only' onTabItemClick={handleTabChange} top>

                            {/* 0 — Dashboard */}
                            <div
                                label={mkIcon(
                                    <LabelPairedObjectsColumnCaptionRegularIcon height='20px' width='20px' fill='var(--text-general)' />,
                                    'Dashboard'
                                )}
                                id='id-dbot-dashboard'
                            >
                                <Dashboard handleTabChange={handleTabChange} />
                            </div>

                            {/* 1 — Bot Builder */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><rect x='3' y='3' width='6' height='6' rx='1'/><rect x='15' y='3' width='6' height='6' rx='1'/><rect x='3' y='15' width='6' height='6' rx='1'/><path d='M15 18h6M18 15v6M9 6h6M9 18h3M12 9v3'/></svg>,
                                    'Bot Builder'
                                )}
                                id='id-ahmed-learning'
                            >
                                <div style={{ height: '100%', background: 'transparent', pointerEvents: 'none' }} />
                            </div>

                            {/* 2 — Free Bots (repositioned here, between Ahmed Learning and D-Circles) */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='8' r='4'/><path d='M6 20v-2a6 6 0 0112 0v2'/><line x1='12' y1='12' x2='12' y2='14'/></svg>,
                                    'Free Bots'
                                )}
                                id='id-bot-library'
                            >
                                <Suspense fallback={tabLoader('Loading Free Bots...')}>
                                    <FreeBots />
                                </Suspense>
                            </div>

                            {/* 3 — Ahmed Scalper Bots */}
                            <div
                                label={mkIcon(
                                    <svg width='19' height='19' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                                        <defs>
                                            <linearGradient id='scalper-tab-gradient' x1='3' y1='21' x2='21' y2='3' gradientUnits='userSpaceOnUse'>
                                                <stop offset='0' stopColor='#22d3ee' />
                                                <stop offset='0.5' stopColor='#a78bfa' />
                                                <stop offset='1' stopColor='#f472b6' />
                                            </linearGradient>
                                        </defs>
                                        <path d='M13.4 2.5 4 13.4h6.6L9.7 21.5 20 10.2h-6.5l-.1-7.7Z'
                                            fill='url(#scalper-tab-gradient)' stroke='#e0f2fe' strokeWidth='0.8'
                                            strokeLinejoin='round' />
                                        <circle cx='4' cy='5' r='1.2' fill='#fbbf24' />
                                        <circle cx='20' cy='18.5' r='1' fill='#34d399' />
                                    </svg>,
                                    'Scalper Bots'
                                )}
                                id='id-scalper-bots'
                            >
                                <Suspense fallback={tabLoader('Loading Scalper Bots...')}>
                                    <ScalperBots />
                                </Suspense>
                            </div>

                            {/* 4 — D-Circles */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='7' cy='12' r='4'/><circle cx='17' cy='12' r='4'/></svg>,
                                    'D-Circles'
                                )}
                                id='id-dcircles'
                            >
                                <Suspense fallback={tabLoader('Loading D-Circles...')}>
                                    <DCircles />
                                </Suspense>
                            </div>

                            {/* 4 — Speed Lab */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/></svg>,
                                    'Speed Lab'
                                )}
                                id='id-speed-lab'
                            >
                                <Suspense fallback={tabLoader('Loading Speed Lab...')}>
                                    <SpeedLab />
                                </Suspense>
                            </div>

                            {/* 5 — Hedge Trading */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M12 2L2 7l10 5 10-5-10-5z'/><path d='M2 17l10 5 10-5'/><path d='M2 12l10 5 10-5'/></svg>,
                                    'Hedge'
                                )}
                                id='id-pro-hedge'
                            >
                                <Suspense fallback={tabLoader('Loading Hedge Trading...')}>
                                    <ProHedge />
                                </Suspense>
                            </div>

                            {/* 6 — Charts */}
                            <div
                                label={mkIcon(
                                    <LabelPairedChartLineCaptionRegularIcon height='20px' width='20px' fill='var(--text-general)' />,
                                    'Charts'
                                )}
                                id={is_chart_modal_visible || is_trading_view_modal_visible ? 'id-charts--disabled' : 'id-charts'}
                            >
                                <Suspense fallback={tabLoader('Loading chart...')}>
                                    <ChartWrapper show_digits_stats={false} />
                                </Suspense>
                            </div>

                            {/* 7 — Manual Trader */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M18 20V10'/><path d='M12 20V4'/><path d='M6 20v-6'/></svg>,
                                    'Manual Trader'
                                )}
                                id='id-manual-trader'
                            >
                                <Suspense fallback={tabLoader('Loading Manual Trader...')}>
                                    <ManualTrader />
                                </Suspense>
                            </div>

                            {/* 8 — Auto Trades */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='3'/><path d='M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83'/></svg>,
                                    'Auto Trades'
                                )}
                                id='id-auto-trades'
                            >
                                <Suspense fallback={tabLoader('Loading Auto Trades...')}>
                                    <AutoTrades />
                                </Suspense>
                            </div>

                            {/* 9 — Copy Trading */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><polyline points='17 1 21 5 17 9'/><path d='M3 11V9a4 4 0 014-4h14'/><polyline points='7 23 3 19 7 15'/><path d='M21 13v2a4 4 0 01-4 4H3'/></svg>,
                                    'Copy Trading'
                                )}
                                id='id-copy-trading'
                            >
                                <Suspense fallback={tabLoader('Loading Copy Trading...')}>
                                    <CopyTrading />
                                </Suspense>
                            </div>

                            {/* 10 — Reports */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/><line x1='16' y1='17' x2='8' y2='17'/></svg>,
                                    'Reports'
                                )}
                                id='id-reports'
                            >
                                <Suspense fallback={tabLoader('Loading Reports...')}>
                                    <Reports />
                                </Suspense>
                            </div>

                            {/* 11 — Bulk Trade */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><rect x='2' y='3' width='6' height='18' rx='1'/><rect x='9' y='8' width='6' height='13' rx='1'/><rect x='16' y='5' width='6' height='16' rx='1'/></svg>,
                                    'Bulk Trade'
                                )}
                                id='id-bulk-trade'
                            >
                                <Suspense fallback={tabLoader('Loading Bulk Trade...')}>
                                    <BulkTrade />
                                </Suspense>
                            </div>

                            {/* 12 — Analysis */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>,
                                    'Analysis'
                                )}
                                id='id-analysis'
                            >
                                <Suspense fallback={tabLoader('Loading Analysis...')}>
                                    <Analysis />
                                </Suspense>
                            </div>

                            {/* 13 — Tutorials */}
                            <div
                                label={mkIcon(
                                    <LegacyGuide1pxIcon height='16px' width='16px' fill='var(--text-general)' className='icon-general-fill-g-path' />,
                                    'Tutorials'
                                )}
                                id='id-tutorial'
                            >
                                <div className='tutorials-wrapper'>
                                    <Suspense fallback={tabLoader('Loading tutorials...')}>
                                        <Tutorial handleTabChange={handleTabChange} />
                                    </Suspense>
                                </div>
                            </div>

                            {/* 14 — Trading Software */}
                            <div
                                label={mkIcon(
                                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><rect x='2' y='3' width='20' height='14' rx='2'/><line x1='8' y1='21' x2='16' y2='21'/><line x1='12' y1='17' x2='12' y2='21'/></svg>,
                                    'Trading Software'
                                )}
                                id='id-trading-software'
                            >
                                <Suspense fallback={tabLoader('Loading Trading Software...')}>
                                    <TradingSoftware />
                                </Suspense>
                            </div>

                        </Tabs>
                        {!isDesktop && right_tab_shadow && <span className='tabs-shadow tabs-shadow--right' />}
                    </div>
                </div>
            </div>

            {/* Floating panels — hide bot runner on chart & manual-trader tabs */}
            {active_tab !== 7 && active_tab !== 8 && active_tab !== 15 && <FloatingRunButton />}
            <WhatsAppFloat />

            <DesktopWrapper>
                <div className='main__run-strategy-wrapper'>
                    <RunStrategy />
                    <RunPanel />
                </div>
                <ChartModal />
                <TradingViewModal />
            </DesktopWrapper>
            <MobileWrapper>{!is_open && <RunPanel />}</MobileWrapper>

            <Dialog
                cancel_button_text={cancel_button_text || localize('Cancel')}
                className='dc-dialog__wrapper--fixed'
                confirm_button_text={ok_button_text || localize('Ok')}
                has_close_icon
                is_mobile_full_width={false}
                is_visible={is_dialog_open}
                onCancel={onCancelButtonClick}
                onClose={onCloseDialog}
                onConfirm={onOkButtonClick || onCloseDialog}
                portal_element_id='modal_root'
                title={title}
                login={handleLoginGeneration}
                dismissable={dismissable}
                is_closed_on_cancel={is_closed_on_cancel}
            >
                {message}
            </Dialog>

            {(() => {
                const modalProps = getTradeTypeModalProps();
                return (
                    <TradeTypeConfirmationModal
                        is_visible={modalProps.is_visible}
                        trade_type_display_name={modalProps.trade_type_display_name}
                        current_trade_type={modalProps.current_trade_type}
                        current_trade_type_display_name={modalProps.current_trade_type_display_name}
                        onConfirm={modalProps.onConfirm}
                        onCancel={modalProps.onCancel}
                    />
                );
            })()}
        </React.Fragment>
    );
});

export default AppWrapper;
