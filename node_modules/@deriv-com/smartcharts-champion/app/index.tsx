import {
    ChartMode,
    ChartSetting,
    ChartTitle,
    createObjectFromLocalStorage,
    DrawTools,
    LogActions,
    LogCategories,
    logEvent,
    Marker,
    setSmartChartsPublicPath,
    Share,
    SmartChart,
    StudyLegend,
    ToolbarWidget,
    Views,
} from '@deriv-com/smartcharts'; // eslint-disable-line import/no-unresolved
import whyDidYouRender from '@welldone-software/why-did-you-render';
import { configure } from 'mobx';
import dayjs from '../src/utils/dayjs-config';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { TNotification } from 'src/store/Notifier';
import {
    TGranularity,
    TNetworkConfig,
    TQuote,
    TRefData,
    TStateChangeListener,
    ProposalOpenContract,
    TGetQuotesRequest,
    ActiveSymbols,
} from 'src/types';
import 'url-search-params-polyfill';
import './app.scss';
import ChartHistory from './ChartHistory';
import ChartNotifier from './ChartNotifier';
import { ConnectionManager, StreamManager, getQuotes, setConnectionManager } from './connection';
import NetworkMonitor from './connection/NetworkMonitor';
import Notification from './Notification';

setSmartChartsPublicPath('./dist/');
const isMobile = window.navigator.userAgent.toLowerCase().includes('mobi');
if (process.env.NODE_ENV !== 'production') {
    whyDidYouRender(React, {
        collapseGroups: true,
        include: [/.*/],
        exclude: [/^RenderInsideChart$/, /^inject-/],
    });
}
const trackJSDomains = ['binary.com', 'binary.me'];
window.isProductionWebsite = trackJSDomains.some(val => window.location.host.endsWith(val));

if (window.isProductionWebsite) {
    window._trackJs = { token: '346262e7ffef497d85874322fff3bbf8', application: 'smartcharts' };
    const s = document.createElement('script');
    s.src = 'https://cdn.trackjs.com/releases/current/tracker.js';
    document.body.appendChild(s);
}

configure({ enforceActions: 'observed' });
function getLanguageStorage() {
    const default_language = 'en';
    try {
        const setting_string = localStorage.getItem('smartchart-setting') || '',
            setting = JSON.parse(setting_string !== '' ? setting_string : '{}');
        return setting.language || default_language;
    } catch (e) {
        return default_language;
    }
}
function getServerUrl() {
    const local = localStorage.getItem('config.server_url');
    return `wss://${local || 'red.derivws.com'}/websockets/v3`;
}
const chartId = '1';
const appId = localStorage.getItem('config.app_id') || 12812;
const serverUrl = getServerUrl();
const language = new URLSearchParams(window.location.search).get('l') || getLanguageStorage();
const today = dayjs().format('YYYY/MM/DD 00:00');
const connectionManager = new ConnectionManager({
    appId,
    language,
    endpoint: serverUrl,
});

// Set the connection manager instance for getQuotes
setConnectionManager(connectionManager);
const IntervalEnum = {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 24 * 3600,
    year: 365 * 24 * 3600,
};
const activeLanguages = [
    'EN',
    'BN',
    'DE',
    'AR',
    'ES',
    'FR',
    'ID',
    'IT',
    'KM',
    'KO',
    'MN',
    'PL',
    'PT',
    'RU',
    'SI',
    'SW',
    'TR',
    'TH',
    'UZ',
    'VI',
    'ZH_CN',
    'ZH_TW',
];
const streamManager = new StreamManager(connectionManager);
// Get trading times and active symbols data
const tradingTimesPromise = connectionManager.send({ trading_times: 'today' });
const activeSymbolsPromise = connectionManager.send({ active_symbols: 'brief' });

// Create subscribeQuotes function for subscribing to real-time quotes
// Store subscription IDs for each subscription
const subscriptionIds: Record<string, string | undefined> = {};

const subscribeQuotes = (
    { symbol, granularity, style }: { symbol: string; granularity?: number; style?: string },
    callback: (quote: TQuote) => void
): (() => void) => {
    // Create a subscription request with all required fields
    const request: any = {
        ticks_history: symbol,
        style: style || granularity ? 'candles' : 'ticks',
        subscribe: 1,
        adjust_start_time: 1,
        count: 1,
        end: 'latest',
        req_id: Math.floor(Math.random() * 1000000), // Generate a random request ID
    };

    // Add granularity if needed
    if (granularity) {
        request.granularity = granularity;
    }

    // Create a handler for the subscription
    const handleResponse = (response: any) => {
        // Store the subscription ID when we receive it
        if (response.subscription && response.subscription.id) {
            const key = `${symbol}-${granularity || 0}`;
            subscriptionIds[key] = response.subscription.id;
        }

        // Process tick data
        if (response.tick) {
            const { tick } = response;
            const epoch = tick.epoch;
            const quote = tick.quote;

            // Create TQuote object with tick data
            const quoteObj: TQuote = {
                Date: new Date(epoch * 1000).toISOString(),
                Close: quote,
                tick,
                DT: new Date(epoch * 1000),
            };

            callback(quoteObj);
        }

        // Process candle data
        if (response.ohlc) {
            const { ohlc } = response;
            const epoch = ohlc.open_time;

            // Create TQuote object with OHLC data
            const quoteObj: TQuote = {
                Date: new Date(epoch * 1000).toISOString(),
                Open: parseFloat(ohlc.open),
                High: parseFloat(ohlc.high),
                Low: parseFloat(ohlc.low),
                Close: parseFloat(ohlc.close),
                ohlc,
                DT: new Date(epoch * 1000),
            };

            callback(quoteObj);
        }
    };

    // Subscribe to the stream
    streamManager.subscribe(request, handleResponse);

    return () => {
        // Create a forget request with all required fields
        const forgetRequest = {
            ticks_history: symbol,
            granularity: granularity || undefined,
            req_id: Math.floor(Math.random() * 1000000), // Generate a random request ID
        };

        // Call the streamManager forget method
        streamManager.forget(forgetRequest, handleResponse);
    };
};
const requestAPI = connectionManager.send.bind(connectionManager);

// Modified unsubscribeQuotes to handle subscription IDs
const unsubscribeQuotes = (request?: TGetQuotesRequest) => {
    // Extract symbol and granularity from the request to create the key
    if (!request?.symbol) return;
    const { symbol, granularity = 0, ticks_history = '' } = request;
    const key = `${symbol || ticks_history}-${granularity || 0}`;

    // If we have a subscription ID for this key, add it to the request
    if (subscriptionIds[key]) {
        // Create a forget request with the subscription ID
        const forgetRequest = {
            forget: subscriptionIds[key],
            req_id: Math.floor(Math.random() * 1000000), // Generate a random request ID
        };

        // Call the connectionManager directly to forget the subscription
        connectionManager
            .send(forgetRequest)
            .then(() => {
                delete subscriptionIds[key];
            })
            .catch(error => {
                console.error('Error forgetting subscription:', error);
            });
    }
    // Call the streamManager forget method
    streamManager.forget(request);

    // Call the original forget method as a fallback
    // We need to adapt the callback to match what streamManager.forget expects
    // streamManager.forget(request, (response: TicksHistoryResponse) => {
    //     // Create a TQuote object from the TicksHistoryResponse if needed
    //     // This is a simplified adapter - in a real implementation, you'd need to
    //     // properly convert from TicksHistoryResponse to TQuote based on your app's logic
    //     if (response) {
    //         if(!callback) return;
    //         callback(response as any);
    //     }
    // });
};
const App = () => {
    const startingLanguageRef = React.useRef('en');
    const [tradingTimes, setTradingTimes] = React.useState<
        Record<string, { isOpen: boolean; openTime: string; closeTime: string }> | undefined
    >(undefined);
    const [activeSymbols, setActiveSymbols] = React.useState<ActiveSymbols>();
    const [isLoading, setIsLoading] = React.useState<boolean>(true);

    React.useEffect(() => {
        setIsLoading(true);

        // Fetch both trading times and active symbols
        Promise.all([tradingTimesPromise, activeSymbolsPromise])
            .then(([tradingTimesResponse, activeSymbolsResponse]) => {
                // Process trading times
                if (tradingTimesResponse.trading_times) {
                    // Create simplified trading times format
                    const simplified: Record<string, { isOpen: boolean; openTime: string; closeTime: string }> = {};

                    tradingTimesResponse.trading_times.markets.forEach(market => {
                        market.submarkets?.forEach(submarket => {
                            submarket.symbols?.forEach(symbolObj => {
                                const { symbol, times } = symbolObj;
                                const { open, close } = times;

                                // Determine if market is open
                                const now = new Date();
                                const dateStr = now.toISOString().substring(0, 11);
                                const isOpenAllDay =
                                    open.length === 1 && open[0] === '00:00:00' && close[0] === '23:59:59';
                                const isClosedAllDay = open.length === 1 && open[0] === '--' && close[0] === '--';

                                let isOpen = isOpenAllDay;
                                let openTime = '';
                                let closeTime = '';

                                if (!isClosedAllDay && open.length > 0 && close.length > 0) {
                                    openTime = `${dateStr}${open[0]}Z`;
                                    closeTime = `${dateStr}${close[0]}Z`;

                                    const openDate = new Date(openTime);
                                    const closeDate = new Date(closeTime);

                                    isOpen = now >= openDate && now < closeDate;
                                }

                                simplified[symbol] = {
                                    isOpen,
                                    openTime,
                                    closeTime,
                                };
                            });
                        });
                    });

                    setTradingTimes(simplified);
                }

                // Process active symbols
                if (activeSymbolsResponse.active_symbols) {
                    setActiveSymbols(activeSymbolsResponse.active_symbols);
                }

                setIsLoading(false);
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                setIsLoading(false);
            });
    }, []);

    const [notifier] = React.useState(new ChartNotifier());
    const [layoutString] = React.useState(localStorage.getItem(`layout-${chartId}`) || '');
    const [layout] = React.useState(JSON.parse(layoutString !== '' ? layoutString : '{}'));
    const initialSettings = React.useMemo(() => {
        let _settings = createObjectFromLocalStorage('smartchart-setting');
        if (_settings) {
            _settings.language = language;
            startingLanguageRef.current = _settings.language;
        } else {
            _settings = { language };
        }
        _settings.activeLanguages = activeLanguages;
        if (_settings.historical) {
            _settings.isHighestLowestMarkerEnabled = false;
        }
        return _settings;
    }, []);

    const [settings, setSettings] = React.useState(initialSettings);
    const settingsRef = React.useRef<typeof settings>();
    settingsRef.current = settings;

    const memoizedValues = React.useMemo(() => {
        let endEpoch: number | undefined,
            granularity: number | undefined,
            chartType = '',
            symbol = '';
        if (settingsRef.current.historical) {
            endEpoch = new Date(`${today}:00Z`).valueOf() / 1000;
            chartType = 'line';
            granularity = 0;
            if (layout) {
                granularity =
                    layout.timeUnit === 'second'
                        ? 0
                        : parseInt(
                              (layout.interval * IntervalEnum[layout.timeUnit as keyof typeof IntervalEnum]).toString(),
                              10
                          ); // eslint-disable-line
                if (layout.chartType === 'candles' && layout.aggregationType !== 'ohlc') {
                    chartType = layout.aggregationType;
                } else {
                    chartType = layout.chartType;
                }
                symbol = layout.symbol;
            }
        }
        return {
            chartType,
            granularity,
            endEpoch,
            symbol,
        };
    }, [layout]);
    const [chartType, setChartType] = React.useState<string | undefined>(memoizedValues.chartType);
    const [granularity, setGranularity] = React.useState<TGranularity>(memoizedValues.granularity as TGranularity);
    const [endEpoch, setEndEpoch] = React.useState(memoizedValues.endEpoch);
    const [isConnectionOpened, setIsConnectionOpened] = React.useState(true);
    const [networkStatus, setNetworkStatus] = React.useState<TNetworkConfig>();
    const [symbol, setSymbol] = React.useState<string>(memoizedValues.symbol);
    const contractInfo: keyof ProposalOpenContract | Record<string, never> = {};
    React.useEffect(() => {
        connectionManager.on(ConnectionManager.EVENT_CONNECTION_CLOSE, () => setIsConnectionOpened(false));
        connectionManager.on(ConnectionManager.EVENT_CONNECTION_REOPEN, () => setIsConnectionOpened(true));
        const networkMonitor = NetworkMonitor.getInstance();
        networkMonitor.init(requestAPI, handleNetworkStatus);
    }, []);
    const handleNetworkStatus = (status: TNetworkConfig) => setNetworkStatus(status);
    const saveSettings = React.useCallback((newSettings: any) => {
        const prevSetting = settingsRef.current;
        localStorage.setItem('smartchart-setting', JSON.stringify(newSettings));
        if (!prevSetting.historical && newSettings.historical) {
            setChartType('line');
            setGranularity(0);
            setEndEpoch(new Date(`${today}:00Z`).valueOf() / 1000);
        } else if (!newSettings.historical) {
            handleDateChange('');
        }
        setSettings(newSettings);
        if (startingLanguageRef.current !== newSettings.language) {
            // Place language in URL:
            const { origin, search, pathname } = window.location;
            const url = new URLSearchParams(search);
            url.delete('l');
            url.set('l', newSettings.language);
            window.location.href = `${origin}${pathname}?${url.toString()}`;
        }
    }, []);
    const handleDateChange = (value: string) => {
        setEndEpoch(value !== '' ? new Date(`${value}:00Z`).valueOf() / 1000 : undefined);
    };
    const handleStateChange: TStateChangeListener = (tag, option) =>
        console.log(`chart state changed to ${tag} with the option of ${option ? JSON.stringify(option) : '{}'}`);
    const renderTopWidgets = React.useCallback(() => {
        const symbolChange = (new_symbol: string) => {
            logEvent(LogCategories.ChartTitle, LogActions.MarketSelector, new_symbol);
            notifier.removeByCategory('activesymbol');

            setSymbol(new_symbol);
        };
        return (
            <>
                <ChartTitle onChange={symbolChange} isNestedList={isMobile} />
                {settingsRef.current.historical ? <ChartHistory onChange={handleDateChange} /> : ''}
                <Notification notifier={notifier} />
            </>
        );
    }, [notifier]);
    const renderControls = React.useCallback(() => <ChartSetting />, []);
    const renderToolbarWidget = React.useCallback(() => {
        const changeGranularity = (timePeriod: TGranularity) => setGranularity(timePeriod);
        const changeChartType = (_chartType?: string) => setChartType(_chartType);
        return (
            <ToolbarWidget>
                <ChartMode onChartType={changeChartType} onGranularity={changeGranularity} />
                <StudyLegend />
                <Views onChartType={changeChartType} onGranularity={changeGranularity} />
                <DrawTools />
                <Share />
            </ToolbarWidget>
        );
    }, []);
    const onMessage = (e: TNotification) => {
        notifier.notify(e);
    };
    const getIsChartReady = (isChartReady: boolean) => isChartReady;
    const onMarkerRef = (ref: TRefData | null) => {
        if (ref) {
            ref.setPosition({
                epoch: endEpoch,
            });
        }
    };
    const ref = React.useRef(null);

    // Show loading indicator while data is being fetched
    if (isLoading) {
        return <></>;
    }

    return (
        <SmartChart
            drawingToolFloatingMenuPosition={isMobile ? { x: 100, y: 100 } : { x: 200, y: 200 }}
            ref={ref}
            id={chartId}
            chartStatusListener={(isChartReady: boolean) => getIsChartReady(isChartReady)}
            stateChangeListener={handleStateChange}
            isMobile={isMobile}
            symbol={symbol}
            settings={settings}
            onMessage={onMessage}
            enableRouting
            topWidgets={renderTopWidgets}
            toolbarWidget={renderToolbarWidget}
            chartControlsWidgets={renderControls}
            unsubscribeQuotes={unsubscribeQuotes}
            endEpoch={endEpoch}
            chartType={chartType}
            granularity={granularity}
            onSettingsChange={saveSettings}
            isConnectionOpened={isConnectionOpened}
            networkStatus={networkStatus}
            isLive
            enabledChartFooter
            contractInfo={contractInfo}
            chartData={{ tradingTimes, activeSymbols }}
            getQuotes={getQuotes}
            subscribeQuotes={subscribeQuotes}
            getIndicatorHeightRatio={(chart_height: number, indicator_count: number) => {
                const isSmallScreen = chart_height < 780;
                const denominator = indicator_count >= 5 ? indicator_count : indicator_count + 1;
                const reservedHeight = isMobile ? 100 : 320;
                const indicatorsHeight = Math.round(
                    (chart_height - (reservedHeight + (isSmallScreen ? 20 : 0))) / denominator
                );
                return {
                    height: indicatorsHeight,
                    percent: indicatorsHeight / chart_height,
                };
            }}
        >
            {endEpoch ? (
                <Marker className='chart-marker-historical' markerRef={onMarkerRef}>
                    <span>
                        {dayjs(endEpoch * 1000)
                            .utc()
                            .format('DD MMMM YYYY - HH:mm')}
                    </span>
                </Marker>
            ) : (
                ''
            )}
        </SmartChart>
    );
};
const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
