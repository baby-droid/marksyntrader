// @ts-nocheck
import React, { useState } from 'react';
import { useStore } from '@/hooks/useStore';
import './ChartSettingsSidebar.scss';

type NativeTool = 'chart' | 'indicators' | 'drawing' | 'download';

const GRANULARITY_LABELS: Record<number, string> = {
    0: '1t',
    60: '1m',
    120: '2m',
    180: '3m',
    300: '5m',
    600: '10m',
    900: '15m',
    1800: '30m',
    3600: '1h',
    7200: '2h',
    14400: '4h',
    28800: '8h',
    86400: '1d',
};

const IconChart = () => (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M4 18V6m0 12h16M7 15l3-4 3 2 4-6' />
    </svg>
);

const IconIndicators = () => (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M4 17c3-7 6-7 8-2s5 5 8-6' />
        <path d='M5 7h3M16 18h3' />
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

const NATIVE_SELECTORS: Record<NativeTool, string> = {
    chart: '.chart-native-control--chart',
    indicators: '.chart-native-control--study',
    drawing: '.chart-native-control--drawing',
    download: '.chart-native-control--share',
};

const ChartSettingsSidebar: React.FC = () => {
    const { chart_store } = useStore();
    const [activeTool, setActiveTool] = useState<NativeTool>('chart');
    const granularity = Number(chart_store?.granularity ?? 0);
    const intervalLabel = GRANULARITY_LABELS[granularity] ?? '1t';

    const openNativeTool = (tool: NativeTool) => {
        const control = document.querySelector(NATIVE_SELECTORS[tool]);
        const button = control?.querySelector(
            '.cq-menu-btn, button, [role="button"]',
        ) as HTMLElement | null;

        if (!button) return;
        setActiveTool(tool);
        button.click();
    };

    const tools: Array<{
        id: NativeTool;
        label: string;
        icon: React.ReactNode;
        badge?: string;
    }> = [
        { id: 'chart', label: 'Chart type and time interval', icon: <IconChart />, badge: intervalLabel },
        { id: 'indicators', label: 'Indicators', icon: <IconIndicators /> },
        { id: 'drawing', label: 'Drawing tools and lines', icon: <IconDrawing /> },
        { id: 'download', label: 'Download and share chart', icon: <IconDownload /> },
    ];

    return (
        <aside className='chart-settings-sidebar' aria-label='SmartChart tools'>
            <nav className='chart-settings-sidebar__rail'>
                {tools.map(tool => (
                    <button
                        key={tool.id}
                        type='button'
                        className={`chart-settings-sidebar__tool ${activeTool === tool.id ? 'is-active' : ''}`}
                        aria-label={tool.label}
                        title={tool.label}
                        onClick={() => openNativeTool(tool.id)}
                    >
                        {tool.badge && (
                            <span className='chart-settings-sidebar__badge' aria-hidden='true'>
                                {tool.badge}
                            </span>
                        )}
                        {tool.icon}
                    </button>
                ))}
            </nav>
        </aside>
    );
};

export default ChartSettingsSidebar;