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

    const uniqueKey = client.loginid ? `${prefix}-${client.loginid}` : `${prefix}-${uuid}`;
    const symbol = chart_store?.symbol || 'R_100';

    return (
        <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <Chart key={uniqueKey} show_digits_stats={show_digits_stats} />
            </div>
            <ChartTradePanel symbol={symbol} />
        </div>
    );
});

export default ChartWrapper;
