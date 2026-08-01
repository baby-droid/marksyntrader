// @ts-nocheck
/**
 * ChartSettingsSidebar — vertical icon strip overlaid at the left edge of
 * the SmartChart canvas. Matches the design shown in the reference screenshot:
 *   1T label → line-chart type → indicators → OHLC bars → drawing → download
 */
import React, { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import './ChartSettingsSidebar.scss';

/* ── Icon SVGs ─────────────────────────────────────────────────────────────── */
const IconLine = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <polyline points='22 12 18 12 15 21 9 3 6 12 2 12' />
    </svg>
);
const IconCandle = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <line x1='18' y1='2' x2='18' y2='6' /><rect x='15' y='6' width='6' height='8' rx='1' />
        <line x1='18' y1='14' x2='18' y2='22' /><line x1='6' y1='4' x2='6' y2='8' />
        <rect x='3' y='8' width='6' height='7' rx='1' /><line x1='6' y1='15' x2='6' y2='20' />
    </svg>
);
const IconIndicators = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <polyline points='3 18 9 12 13 16 21 8' /><line x1='21' y1='3' x2='21' y2='9' /><line x1='15' y1='3' x2='21' y2='3' />
    </svg>
);
const IconBar = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <line x1='4'  y1='20' x2='4'  y2='4' /><line x1='4'  y1='4'  x2='10' y2='4' /><line x1='4'  y1='12' x2='10' y2='12' />
        <line x1='12' y1='20' x2='12' y2='9' /><line x1='12' y1='9'  x2='18' y2='9' /><line x1='12' y1='15' x2='18' y2='15' />
        <line x1='20' y1='20' x2='20' y2='2' /><line x1='20' y1='2'  x2='24' y2='2' /><line x1='20' y1='11' x2='24' y2='11' />
    </svg>
);
const IconDraw = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M12 20h9'/><path d='M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z'/>
    </svg>
);
const IconDownload = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1='12' y1='15' x2='12' y2='3'/>
    </svg>
);

/* ── Granularity helpers ────────────────────────────────────────────────────── */
const GRAN_STEPS = [0, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400];
const granLabel = (g: number): string => {
    if (g === 0)     return '1T';
    if (g < 60)      return `${g}S`;
    if (g < 3600)    return `${g / 60}M`;
    if (g < 86400)   return `${g / 3600}H`;
    return '1D';
};

/* ── Component ──────────────────────────────────────────────────────────────── */
const ChartSettingsSidebar: React.FC = () => {
    const { chart_store } = useStore();
    const [showGranPicker, setShowGranPicker] = useState(false);
    const [showTypePicker, setShowTypePicker] = useState(false);

    const chartType  = chart_store?.chart_type   ?? 'line';
    const granularity = chart_store?.granularity ?? 0;

    const handleGran = (g: number) => {
        chart_store?.updateGranularity(g);
        setShowGranPicker(false);
    };

    const handleChartType = (t: string) => {
        chart_store?.updateChartType(t);
        setShowTypePicker(false);
    };

    const handleDownload = () => {
        try {
            const canvas = document.querySelector('.ciq-canvas') as HTMLCanvasElement;
            if (canvas) {
                const link = document.createElement('a');
                link.download = `chart-${Date.now()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }
        } catch { /* ignore cross-origin canvas issues */ }
    };

    return (
        <div className='css-sidebar'>
            {/* ── Granularity chip ── */}
            <div className='css-sidebar__item css-sidebar__item--label'
                title='Timeframe'
                onClick={() => { setShowGranPicker(v => !v); setShowTypePicker(false); }}>
                <span className='css-sidebar__gran'>{granLabel(granularity)}</span>
            </div>

            {/* ── Chart type ── */}
            <div className={`css-sidebar__item ${chartType === 'line' || chartType === 'mountain' ? 'active' : ''}`}
                title='Line chart'
                onClick={() => { setShowTypePicker(v => !v); setShowGranPicker(false); }}>
                <IconLine />
            </div>

            {/* ── Indicators (opens SmartChart's built-in indicator panel) ── */}
            <div className='css-sidebar__item'
                title='Studies / Indicators'
                onClick={() => {
                    try {
                        (document.querySelector('.ciq-menu .cq-menu-btn') as HTMLElement)?.click();
                    } catch { /* noop */ }
                }}>
                <IconIndicators />
            </div>

            {/* ── Bar / OHLC ── */}
            <div className={`css-sidebar__item ${chartType === 'bar' || chartType === 'candle' ? 'active' : ''}`}
                title='Candle/Bar chart'
                onClick={() => handleChartType(chartType === 'candle' ? 'bar' : 'candle')}>
                <IconCandle />
            </div>

            {/* ── Drawing tools ── */}
            <div className='css-sidebar__item'
                title='Drawing tools'
                onClick={() => {
                    try {
                        (document.querySelector('[class*="ciq-draw"]') as HTMLElement)?.click();
                    } catch { /* noop */ }
                }}>
                <IconDraw />
            </div>

            {/* ── Download ── */}
            <div className='css-sidebar__item' title='Download chart' onClick={handleDownload}>
                <IconDownload />
            </div>

            {/* ── Granularity picker ── */}
            {showGranPicker && (
                <div className='css-sidebar__picker' onClick={() => setShowGranPicker(false)}>
                    <div className='css-sidebar__picker-panel' onClick={e => e.stopPropagation()}>
                        <div className='css-sidebar__picker-title'>Timeframe</div>
                        {GRAN_STEPS.map(g => (
                            <button
                                key={g}
                                className={`css-sidebar__picker-btn ${granularity === g ? 'active' : ''}`}
                                onClick={() => handleGran(g)}
                            >
                                {granLabel(g)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Chart type picker ── */}
            {showTypePicker && (
                <div className='css-sidebar__picker' onClick={() => setShowTypePicker(false)}>
                    <div className='css-sidebar__picker-panel' onClick={e => e.stopPropagation()}>
                        <div className='css-sidebar__picker-title'>Chart Type</div>
                        {[
                            { id: 'line',     label: '↗ Line'      },
                            { id: 'mountain', label: '🏔 Mountain'  },
                            { id: 'candle',   label: '🕯 Candlestick' },
                            { id: 'bar',      label: '📊 OHLC Bar'  },
                            { id: 'dot',      label: '● Dot'        },
                        ].map(t => (
                            <button
                                key={t.id}
                                className={`css-sidebar__picker-btn ${chartType === t.id ? 'active' : ''}`}
                                onClick={() => handleChartType(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChartSettingsSidebar;
