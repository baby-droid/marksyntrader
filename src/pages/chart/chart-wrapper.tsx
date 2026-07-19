// @ts-nocheck
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
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: '75% 25%',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                background: '#ffffff',
            }}
        >
            {/* ─── Chart area (75%) ─── */}
            <div style={{ minWidth: 0, overflow: 'hidden', position: 'relative' }}>
                <Chart key={uniqueKey} show_digits_stats={show_digits_stats} />
            </div>

            {/* ─── Trading panel (25%) ─── */}
            <div style={{ minWidth: 0, overflow: 'hidden', borderLeft: '1px solid #e8e8e8' }}>
                <ChartTradePanel
                    symbol={symbol}
                    onSymbolChange={(s: string) => {
                        if (chart_store?.updateSymbol) {
                            chart_store.updateSymbol(s);
                        }
                    }}
                />
            </div>
        </div>
    );
});

export default ChartWrapper;
