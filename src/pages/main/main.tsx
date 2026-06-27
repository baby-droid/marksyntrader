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
    LabelPairedPuzzlePieceTwoCaptionBoldIcon,
} from '@deriv/quill-icons/LabelPaired';
import { LegacyGuide1pxIcon } from '@deriv/quill-icons/Legacy';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import RunPanel from '../../components/run-panel';
import BotBuilder from '../bot-builder';
import ChartModal from '../chart/chart-modal';
import Dashboard from '../dashboard';
import RunStrategy from '../dashboard/run-strategy';
import LoadingPage from '../loading';
import AIScanner from '../../components/floating/AIScanner';
import RiskDisclaimer from '../../components/floating/RiskDisclaimer';
import './main.scss';

const ChartWrapper = lazy(() => import('../chart/chart-wrapper'));
const Tutorial = lazy(() => import('../tutorials'));
const BotLibrary = lazy(() => import('../bot-library'));
const DCircles = lazy(() => import('../d-circles'));
const BulkTrade = lazy(() => import('../bulk-trade'));
const HedgeTrading = lazy(() => import('../hedge-trading'));
const SpeedLab = lazy(() => import('../speedlab'));
const AutoTrades = lazy(() => import('../auto-trades'));
const CopyTrading = lazy(() => import('../copy-trading'));
const Report = lazy(() => import('../report'));
const ManualTrader = lazy(() => import('../manual-trader'));

const TabIcon = ({ children }: { children: React.ReactNode }) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{children}</span>
);

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
    const { cancel_button_text, ok_button_text, title, message, dismissable, is_closed_on_cancel } = dialog_options as {
        [key: string]: string;
    };
    const { clear } = summary_card;
    const { DASHBOARD, BOT_BUILDER } = DBOT_TABS;
    const init_render = React.useRef(true);
    const hash = [
        'dashboard', 'bot_builder', 'chart', 'tutorial', 'bot_library',
        'dcircles', 'bulk_trade', 'hedge', 'speedlab', 'auto_trades',
        'copy_trading', 'report', 'manual_trader',
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

    React.useEffect(() => {
        setModalStateChangeCallback(new_state => {
            setTradeTypeModalState(new_state);
        });
    }, [is_loading]);

    React.useEffect(() => {
        resetUrlParamProcessing();
    }, [location.search]);

    React.useEffect(() => {
        const el_dashboard = document.getElementById('id-dbot-dashboard');
        const el_last = document.getElementById('id-manual-trader');

        const observerDash = new window.IntersectionObserver(
            ([entry]) => { setLeftTabShadow(!entry.isIntersecting); },
            { root: null, threshold: 0.5 }
        );

        const observerLast = new window.IntersectionObserver(
            ([entry]) => { setRightTabShadow(!entry.isIntersecting); },
            { root: null, threshold: 0.5 }
        );

        if (el_dashboard) observerDash.observe(el_dashboard);
        if (el_last) observerLast.observe(el_last);

        return () => {
            if (el_dashboard) observerDash.unobserve(el_dashboard);
            if (el_last) observerLast.unobserve(el_last);
        };
    });

    React.useEffect(() => {
        if (connectionStatus !== CONNECTION_STATUS.OPENED) {
            const is_bot_running = document.getElementById('db-animation__stop-button') !== null;
            if (is_bot_running) {
                clear();
                stopBot();
                api_base.setIsRunning(false);
                setWebSocketState(false);
            }
        }
    }, [clear, connectionStatus, setWebSocketState, stopBot]);

    const updateTabShadowsHeight = () => {
        const botBuilderEl = document.getElementById('id-bot-builder');
        const leftShadow = document.querySelector('.tabs-shadow--left') as HTMLElement;
        const rightShadow = document.querySelector('.tabs-shadow--right') as HTMLElement;

        if (botBuilderEl && leftShadow && rightShadow) {
            const height = botBuilderEl.offsetHeight;
            leftShadow.style.height = `${height}px`;
            rightShadow.style.height = `${height}px`;
        }
    };

    React.useEffect(() => {
        let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

        if (active_tab === BOT_BUILDER) {
            requestAnimationFrame(() => {
                disableUrlParameterApplication();
                setupTradeTypeChangeListener();

                const handleTradeTypeModal = () => {
                    checkAndShowTradeTypeModal(
                        () => { enableUrlParameterApplication(); },
                        () => {}
                    );
                };

                if (!blockly_store.is_loading) {
                    setTimeout(() => { handleTradeTypeModal(); }, 500);
                } else {
                    let pollAttempts = 0;
                    const maxPollAttempts = 10;
                    const checkBlocklyLoaded = () => {
                        if (!blockly_store.is_loading) {
                            handleTradeTypeModal();
                            return;
                        }
                        if (pollAttempts < maxPollAttempts) {
                            pollAttempts++;
                            pollTimeoutId = setTimeout(checkBlocklyLoaded, 500);
                        }
                    };
                    checkBlocklyLoaded();
                }
            });
        }

        return () => {
            if (pollTimeoutId) {
                clearTimeout(pollTimeoutId);
                pollTimeoutId = null;
            }
        };
    }, [active_tab, is_loading]);

    React.useEffect(() => {
        updateTabShadowsHeight();

        if (is_open) {
            setTourDialogVisibility(false);
        }
        if (init_render.current) {
            setActiveTab(Number(active_hash_tab));
            if (!isDesktop) handleTabChange(Number(active_hash_tab));
            init_render.current = false;
        } else {
            const currentSearch = window.location.search;
            navigate(`${currentSearch}#${hash[active_tab] || hash[0]}`);
        }
        if (active_tour !== '') {
            setActiveTour('');
        }

        const mainElement = document.querySelector('.main__container');
        if (active_tab === DBOT_TABS.TUTORIAL && !isDesktop) {
            document.body.style.overflow = 'hidden';
            if (mainElement instanceof HTMLElement) {
                mainElement.classList.add('no-scroll');
            }
        } else {
            document.body.style.overflow = '';
            if (mainElement instanceof HTMLElement) {
                mainElement.classList.remove('no-scroll');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active_tab]);

    React.useEffect(() => {
        const trashcan_init_id = setTimeout(() => {
            if (active_tab === BOT_BUILDER && Blockly?.derivWorkspace?.trashcan) {
                const trashcanY = window.innerHeight - 250;
                let trashcanX;
                if (is_drawer_open) {
                    trashcanX = isDbotRTL() ? 380 : window.innerWidth - 460;
                } else {
                    trashcanX = isDbotRTL() ? 20 : window.innerWidth - 100;
                }
                Blockly?.derivWorkspace?.trashcan?.setTrashcanPosition(trashcanX, trashcanY);
            }
        }, 100);

        return () => { clearTimeout(trashcan_init_id); };
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active_tab, is_drawer_open]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (dashboard_strategies.length > 0) {
            timer = setTimeout(() => { updateWorkspaceName(); });
        }
        return () => { if (timer) clearTimeout(timer); };
    }, [dashboard_strategies, active_tab]);

    const handleTabChange = React.useCallback(
        (tab_index: number) => {
            setActiveTab(tab_index);
            const el_id = TAB_IDS[tab_index];
            if (el_id) {
                const el_tab = document.getElementById(el_id);
                setTimeout(() => {
                    el_tab?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }, 10);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [active_tab]
    );

    const handleLoginGeneration = async () => {
        const oauthUrl = await generateOAuthURL();
        if (oauthUrl) {
            window.location.replace(oauthUrl);
        } else {
            console.error('Failed to generate OAuth URL');
        }
    };

    const tabLoader = (msg: string) => <ChunkLoader message={localize(msg)} />;

    return (
        <React.Fragment>
            {/* Futuristic Loading Page */}
            <LoadingPage is_loading={is_loading} />

            <div className='main main--green'>
                <div
                    className={classNames('main__container', {
                        'main__container--active': active_tour && active_tab === DASHBOARD && !isDesktop,
                    })}
                >
                    <div>
                        {!isDesktop && left_tab_shadow && <span className='tabs-shadow tabs-shadow--left' />}{' '}
                        <Tabs active_index={active_tab} className='main__tabs' onTabItemClick={handleTabChange} top>
                            {/* 0: Dashboard */}
                            <div
                                label={<TabIcon><LabelPairedObjectsColumnCaptionRegularIcon height='20px' width='20px' fill='var(--text-general)' /><Localize i18n_default_text='Dashboard' /></TabIcon>}
                                id='id-dbot-dashboard'
                            >
                                <Dashboard handleTabChange={handleTabChange} />
                            </div>

                            {/* 1: Bot Builder */}
                            <div
                                label={<TabIcon><LabelPairedPuzzlePieceTwoCaptionBoldIcon height='20px' width='20px' fill='var(--text-general)' /><Localize i18n_default_text='Bot Builder' /></TabIcon>}
                                id='id-bot-builder'
                            />

                            {/* 2: Charts */}
                            <div
                                label={<TabIcon><LabelPairedChartLineCaptionRegularIcon height='20px' width='20px' fill='var(--text-general)' /><Localize i18n_default_text='Charts' /></TabIcon>}
                                id={is_chart_modal_visible || is_trading_view_modal_visible ? 'id-charts--disabled' : 'id-charts'}
                            >
                                <Suspense fallback={tabLoader('Please wait, loading chart...')}>
                                    <ChartWrapper show_digits_stats={false} />
                                </Suspense>
                            </div>

                            {/* 3: Tutorials */}
                            <div
                                label={<TabIcon><LegacyGuide1pxIcon height='16px' width='16px' fill='var(--text-general)' className='icon-general-fill-g-path' /><Localize i18n_default_text='Tutorials' /></TabIcon>}
                                id='id-tutorials'
                            >
                                <div className='tutorials-wrapper'>
                                    <Suspense fallback={tabLoader('Please wait, loading tutorials...')}>
                                        <Tutorial handleTabChange={handleTabChange} />
                                    </Suspense>
                                </div>
                            </div>

                            {/* 4: Free Bots */}
                            <div
                                label={<TabIcon><span>🎁</span><span>Free Bots</span></TabIcon>}
                                id='id-bot-library'
                            >
                                <Suspense fallback={tabLoader('Loading Free Bots...')}>
                                    <BotLibrary />
                                </Suspense>
                            </div>

                            {/* 5: D-Circles */}
                            <div
                                label={<TabIcon><span>⬤</span><span>D-Circles</span></TabIcon>}
                                id='id-dcircles'
                            >
                                <Suspense fallback={tabLoader('Loading D-Circles...')}>
                                    <DCircles />
                                </Suspense>
                            </div>

                            {/* 6: Bulk Trade */}
                            <div
                                label={<TabIcon><span>⚡</span><span>Bulk Trade</span></TabIcon>}
                                id='id-bulk-trade'
                            >
                                <Suspense fallback={tabLoader('Loading Bulk Trade...')}>
                                    <BulkTrade />
                                </Suspense>
                            </div>

                            {/* 7: Hedge Trading */}
                            <div
                                label={<TabIcon><span>⚖</span><span>Hedge</span></TabIcon>}
                                id='id-hedge'
                            >
                                <Suspense fallback={tabLoader('Loading Hedge Trading...')}>
                                    <HedgeTrading />
                                </Suspense>
                            </div>

                            {/* 8: SpeedLab */}
                            <div
                                label={<TabIcon><span>🔬</span><span>SpeedLab</span></TabIcon>}
                                id='id-speedlab'
                            >
                                <Suspense fallback={tabLoader('Loading SpeedLab...')}>
                                    <SpeedLab />
                                </Suspense>
                            </div>

                            {/* 9: AutoTrades */}
                            <div
                                label={<TabIcon><span>🕐</span><span>AutoTrades</span></TabIcon>}
                                id='id-auto-trades'
                            >
                                <Suspense fallback={tabLoader('Loading AutoTrades...')}>
                                    <AutoTrades />
                                </Suspense>
                            </div>

                            {/* 10: Copy Trading */}
                            <div
                                label={<TabIcon><span>📋</span><span>Copy Trading</span></TabIcon>}
                                id='id-copy-trading'
                            >
                                <Suspense fallback={tabLoader('Loading Copy Trading...')}>
                                    <CopyTrading />
                                </Suspense>
                            </div>

                            {/* 11: Report */}
                            <div
                                label={<TabIcon><span>📊</span><span>Report</span></TabIcon>}
                                id='id-report'
                            >
                                <Suspense fallback={tabLoader('Loading Report...')}>
                                    <Report />
                                </Suspense>
                            </div>

                            {/* 12: Manual Trader */}
                            <div
                                label={<TabIcon><span>🎮</span><span>Manual Trader</span></TabIcon>}
                                id='id-manual-trader'
                            >
                                <Suspense fallback={tabLoader('Loading Manual Trader...')}>
                                    <ManualTrader />
                                </Suspense>
                            </div>
                        </Tabs>
                        {!isDesktop && right_tab_shadow && <span className='tabs-shadow tabs-shadow--right' />}{' '}
                    </div>
                </div>
            </div>

            <BotBuilder />

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

            {/* Floating Components */}
            <AIScanner />
            <RiskDisclaimer />
        </React.Fragment>
    );
});

export default AppWrapper;
