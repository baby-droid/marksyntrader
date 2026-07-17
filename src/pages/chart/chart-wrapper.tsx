// Removed unused React import - React 17+ JSX transform doesn't require it
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@/hooks/useStore';
import Chart from './chart';
import { ChartTradePanel } from './chart-trade-panel';
import './chart.scss';
import './chart-trade-panel.scss';

interface ChartWrapperProps {
    prefix?: string;
    show_digits_stats: boolean;
}

const ChartWrapper = observer(({ prefix = 'chart', show_digits_stats }: ChartWrapperProps) => {
    const { client, chart_store } = useStore();
    const [uuid] = useState(uuidv4());
    const [chartMinimized, setChartMinimized] = useState(false);

    const uniqueKey = client.loginid ? `${prefix}-${client.loginid}` : `${prefix}-${uuid}`;
    const symbol = chart_store?.symbol || 'R_100';

    return (
        <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
            {/* Minimize/Expand toggle button */}
            <button
                onClick={() => setChartMinimized(v => !v)}
                style={{
                    position: 'absolute', top: '8px', left: chartMinimized ? '8px' : 'calc(100% - 286px)',
                    zIndex: 20, background: 'rgba(30,64,175,0.92)', border: '1px solid rgba(59,130,246,0.5)',
                    color: '#fff', borderRadius: '6px', padding: '4px 10px', fontSize: '11px',
                    fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em',
                    transition: 'left 0.2s',
                }}
                title={chartMinimized ? 'Expand chart' : 'Minimize chart'}
            >
                {chartMinimized ? '▶ Chart' : '◀ Minimize'}
            </button>

            {/* Chart area — collapses when minimized */}
            <div style={{
                width: chartMinimized ? '0' : 'calc(100% - 280px)',
                minWidth: 0, overflow: 'hidden',
                transition: 'width 0.2s',
                flexShrink: 0,
            }}>
                {!chartMinimized && <Chart key={uniqueKey} show_digits_stats={show_digits_stats} />}
            </div>

            {/* Trade panel — expands to full width when chart is minimized */}
            <div style={{
                width: chartMinimized ? '100%' : '280px',
                flexShrink: 0, transition: 'width 0.2s', overflow: 'hidden',
            }}>
                <ChartTradePanel symbol={symbol} />
            </div>
        </div>
    );
});

export default ChartWrapper;
