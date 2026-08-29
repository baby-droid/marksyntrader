import React from 'react';
import { observer } from 'mobx-react-lite';
import { fromUsd, getDisplayCurrency } from '@/utils/currency-display';
import { TBatchSummary } from '@/stores/summary-card-store';

type Props = {
    summary: TBatchSummary;
};

const BatchSummaryCard = observer(({ summary }: Props) => {
    const displayCurrency = summary.currency || getDisplayCurrency();
    const money = (value: number) => `${fromUsd(value).toFixed(2)} ${displayCurrency}`;
    const profitClass = summary.totalProfit >= 0 ? 'batch-summary-card__positive' : 'batch-summary-card__negative';

    return (
        <section className='batch-summary-card' aria-live='polite'>
            <div className='batch-summary-card__eyebrow'>Bulk execution summary</div>
            <div className='batch-summary-card__heading'>
                <h3>{summary.batchId}</h3>
                <span className='batch-summary-card__status'>
                    {summary.pending > 0 ? `${summary.pending} pending` : 'Settled'}
                </span>
            </div>
            <div className='batch-summary-card__grid'>
                <div><span>Contracts</span><strong>{summary.total}</strong></div>
                <div><span>Bought</span><strong>{summary.bought}</strong></div>
                <div><span>Wins</span><strong className='batch-summary-card__positive'>{summary.wins}</strong></div>
                <div><span>Losses</span><strong className='batch-summary-card__negative'>{summary.losses}</strong></div>
                <div><span>Failed</span><strong>{summary.failed}</strong></div>
                <div><span>Total stake</span><strong>{money(summary.totalStake)}</strong></div>
                <div><span>Net P/L</span><strong className={profitClass}>{money(summary.totalProfit)}</strong></div>
            </div>
            <div className='batch-summary-card__meta'>
                {summary.contractType || 'Contract'} · {summary.symbol || 'Market'}
            </div>
        </section>
    );
});

export default BatchSummaryCard;