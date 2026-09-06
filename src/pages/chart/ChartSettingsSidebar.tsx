// @ts-nocheck
import React, { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import './ChartSettingsSidebar.scss';

type PanelId = 'chart' | 'indicators' | 'drawing' | 'download' | null;

const GRANULARITIES = [
    { value: 0, label: '1t' },
    { value: 60, label: '1 minute' },
    { value: 120, label: '2 minutes' },
    { value: 180, label: '3 minutes' },
    { value: 300, label: '5 minutes' },
    { value: 600, label: '10 minutes' },
    { value: 900, label: '15 minutes' },
    { value: 1800, label: '30 minutes' },
    { value: 3600, label: '1 hour' },
    { value: 7200, label: '2 hours' },
    { value: 14400, label: '4 hours' },
    { value: 28800, label: '8 hours' },
    { value: 86400, label: '1 day' },
];

const CHART_TYPES = [
    { value: 'line', label: 'Area', glyph: 'area' },
    { value: 'candles', label: 'Candle', glyph: 'candle' },
    { value: 'hollow', label: 'Hollow', glyph: 'hollow' },
    { value: 'ohlc', label: 'OHLC', glyph: 'ohlc' },
];

const INDICATORS = {
    Momentum: [
        'Awesome Oscillator',
        'Detrended Price Oscillator',
        'MACD',
        'Price Rate of Change',
        'Relative Strength Index (RSI)',
        'Stochastic Oscillator',
        'Stochastic Momentum Index',
        "William's Percent Range",
    ],
    Trend: ['ADX', 'Aroon', 'Parabolic SAR', 'Pivot Points', 'Supertrend'],
    Volatility: ['Average True Range', 'Bollinger Bands', 'Keltner Channels', 'Standard Deviation'],
    'Moving averages': ['Exponential Moving Average', 'Simple Moving Average', 'Weighted Moving Average'],
    Others: ['Volume', 'Ichimoku Cloud', 'Price Channel', 'Zig Zag'],
};

const IconChart = () => (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M4 18V6m0 12h16M7 15l3-4 3 2 4-6' />
    </svg>
);

const IconIndicators = () => (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M3 18l5-6 4 3 8-9M16 6h4v4' />
    </svg>
);

const IconDrawing = () => (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M4 20h5L19 10a2.1 2.1 0 0 0-3-3L6 17v3h3' />
        <path d='M14 8l3 3' />
    </svg>
);

const IconDownload = () => (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3' />
    </svg>
);

const TypeGlyph = ({ type }: { type: string }) => {
    if (type === 'candle' || type === 'hollow') {
        return (
            <svg viewBox='0 0 32 32' aria-hidden='true'>
                <path d='M9 5v22M23 5v22' />
                <rect x='5' y='10' width='8' height='10' rx='1' />
                <rect x='19' y='8' width='8' height='13' rx='1' />
            </svg>
        );
    }
    if (type === 'ohlc') {
        return (
            <svg viewBox='0 0 32 32' aria-hidden='true'>
                <path d='M8 5v22m16-22v22M8 11h7m-7 9h7m9-7h-7m7 8h-7' />
            </svg>
        );
    }
    return (
        <svg viewBox='0 0 32 32' aria-hidden='true'>
            <path d='M4 25 12 17l5 4 11-13v17H4Z' />
            <path d='m4 25 8-8 5 4 11-13' />
        </svg>
    );
};

const ChartSettingsSidebar: React.FC = () => {
    const { chart_store } = useStore();
    const [panel, setPanel] = useState<PanelId>(null);
    const [indicatorCategory, setIndicatorCategory] = useState('Momentum');

    const chartType = chart_store?.chart_type ?? 'line';
    const granularity = Number(chart_store?.granularity ?? 0);
    const selectedType = CHART_TYPES.find(type => type.value === chartType)?.value ?? 'line';
    const selectedGranularity = GRANULARITIES.find(item => item.value === granularity)?.label ?? '1t';

    const togglePanel = (nextPanel: Exclude<PanelId, null>) => {
        setPanel(current => current === nextPanel ? null : nextPanel);
    };

    const selectChartType = (type: string) => {
        chart_store?.updateChartType(type);
    };

    const selectGranularity = (value: number) => {
        chart_store?.updateGranularity(value);
        // SmartChart renders tick data as an area chart. Candle families are
        // only valid once the feed is returning OHLC candles.
        if (value === 0) chart_store?.updateChartType('line');
    };

    const openNativeTool = (tool: 'indicator' | 'drawing' | 'share') => {
        const selector = tool === 'indicator'
            ? '.chart-native-control--study'
            : tool === 'drawing'
                ? '.chart-native-control--drawing'
                : '.chart-native-control--share';
        const button = document.querySelector(
            `${selector} .cq-menu-btn, ${selector} button, ${selector} [role="button"]`,
        ) as HTMLElement | null;
        button?.click();
    };

    const downloadChart = () => {
        const canvas = document.querySelector(
            '.ciq-chart-area canvas, .ciq-canvas, canvas',
        ) as HTMLCanvasElement | null;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `marksyntrader-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const panelTitle = panel === 'chart'
        ? 'Chart settings'
        : panel === 'indicators'
            ? 'Indicators'
            : panel === 'drawing'
                ? 'Drawing tools'
                : 'Download & share';

    return (
        <div className='chart-settings-sidebar'>
            <nav className='chart-settings-sidebar__rail' aria-label='Chart tools'>
                <button
                    type='button'
                    className={`chart-settings-sidebar__tool ${panel === 'chart' ? 'is-active' : ''}`}
                    aria-label='Chart type and time interval'
                    aria-expanded={panel === 'chart'}
                    onClick={() => togglePanel('chart')}
                >
                    <span className='chart-settings-sidebar__badge'>{selectedGranularity}</span>
                    <IconChart />
                </button>
                <button
                    type='button'
                    className={`chart-settings-sidebar__tool ${panel === 'indicators' ? 'is-active' : ''}`}
                    aria-label='Indicators'
                    aria-expanded={panel === 'indicators'}
                    onClick={() => togglePanel('indicators')}
                >
                    <IconIndicators />
                </button>
                <button
                    type='button'
                    className={`chart-settings-sidebar__tool ${panel === 'drawing' ? 'is-active' : ''}`}
                    aria-label='Drawing tools'
                    aria-expanded={panel === 'drawing'}
                    onClick={() => togglePanel('drawing')}
                >
                    <IconDrawing />
                </button>
                <button
                    type='button'
                    className={`chart-settings-sidebar__tool ${panel === 'download' ? 'is-active' : ''}`}
                    aria-label='Download chart'
                    aria-expanded={panel === 'download'}
                    onClick={() => togglePanel('download')}
                >
                    <IconDownload />
                </button>
            </nav>

            {panel && (
                <section className='chart-settings-sidebar__panel' aria-label={panelTitle}>
                    <header className='chart-settings-sidebar__header'>
                        <h2>{panelTitle}</h2>
                        <button type='button' className='chart-settings-sidebar__close' aria-label='Close chart tools' onClick={() => setPanel(null)}>
                            ×
                        </button>
                    </header>

                    {panel === 'chart' && (
                        <div className='chart-settings-sidebar__body'>
                            <h3>Chart types</h3>
                            <div className='chart-settings-sidebar__types'>
                                {CHART_TYPES.map(type => (
                                    <button
                                        type='button'
                                        key={type.value}
                                        className={`chart-settings-sidebar__type ${selectedType === type.value ? 'is-selected' : ''}`}
                                        onClick={() => selectChartType(type.value)}
                                    >
                                        <TypeGlyph type={type.glyph} />
                                        <span>{type.label}</span>
                                    </button>
                                ))}
                            </div>
                            <h3>Time interval</h3>
                            <div className='chart-settings-sidebar__intervals'>
                                {GRANULARITIES.map(item => (
                                    <button
                                        type='button'
                                        key={item.value}
                                        className={granularity === item.value ? 'is-selected' : ''}
                                        onClick={() => selectGranularity(item.value)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {panel === 'indicators' && (
                        <div className='chart-settings-sidebar__split'>
                            <div className='chart-settings-sidebar__categories'>
                                {Object.keys(INDICATORS).map(category => (
                                    <button
                                        type='button'
                                        key={category}
                                        className={indicatorCategory === category ? 'is-selected' : ''}
                                        onClick={() => setIndicatorCategory(category)}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                            <div className='chart-settings-sidebar__items'>
                                <p className='chart-settings-sidebar__hint'>
                                    Choose an indicator to open the official SmartChart study settings.
                                </p>
                                {INDICATORS[indicatorCategory].map(indicator => (
                                    <button
                                        type='button'
                                        className='chart-settings-sidebar__item'
                                        key={indicator}
                                        onClick={() => openNativeTool('indicator')}
                                    >
                                        <span className='chart-settings-sidebar__item-glyph'>∿</span>
                                        {indicator}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {panel === 'drawing' && (
                        <div className='chart-settings-sidebar__body'>
                            <p className='chart-settings-sidebar__hint'>
                                Select a tool, then draw directly on the live chart.
                            </p>
                            {['Trend line', 'Horizontal line', 'Vertical line', 'Fibonacci retracement', 'Rectangle'].map(tool => (
                                <button type='button' className='chart-settings-sidebar__action' key={tool} onClick={() => openNativeTool('drawing')}>
                                    <span className='chart-settings-sidebar__action-icon'>↗</span>
                                    <span>{tool}</span>
                                    <span className='chart-settings-sidebar__action-arrow'>›</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {panel === 'download' && (
                        <div className='chart-settings-sidebar__body'>
                            <p className='chart-settings-sidebar__hint'>
                                Save the current chart view or open the official sharing controls.
                            </p>
                            <button type='button' className='chart-settings-sidebar__action' onClick={downloadChart}>
                                <span className='chart-settings-sidebar__action-icon'>↓</span>
                                <span>Download chart as PNG</span>
                                <span className='chart-settings-sidebar__action-arrow'>›</span>
                            </button>
                            <button type='button' className='chart-settings-sidebar__action' onClick={() => openNativeTool('share')}>
                                <span className='chart-settings-sidebar__action-icon'>↗</span>
                                <span>Open chart sharing</span>
                                <span className='chart-settings-sidebar__action-arrow'>›</span>
                            </button>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default ChartSettingsSidebar;