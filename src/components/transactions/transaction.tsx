// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import ContentLoader from 'react-content-loader';
import Money from '@/components/shared_ui/money';
import { TContractInfo } from '@/components/summary/summary-card.types';
import { popover_zindex } from '@/constants/z-indexes';
import { getContractTypeName } from '@/external/bot-skeleton';
import { isDbotRTL } from '@/external/bot-skeleton/utils/workspace';
import { getSymbolDisplayNameSync } from '@/utils/symbol-display-name';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { LegacyRadioOffIcon, LegacyRadioOnIcon } from '@deriv/quill-icons';
import { Localize, localize } from '@deriv-com/translations';
import { MarketIcon } from '../market/market-icon';
import { convertDateFormat } from '../shared';
import Popover from '../shared_ui/popover';
import { TradeTypeIcon } from '../trade-type/trade-type-icon';

type TTransactionIconWithText = {
    icon: React.ReactElement;
    title: string;
    message?: React.ReactNode;
    className?: string;
};

type TPopoverItem = {
    icon?: React.ReactElement;
    title: string;
    children: React.ReactNode;
};

type TPopoverContent = {
    contract: TContractInfo;
};

type TTransaction = {
    contract?: TContractInfo | null;
    onClickTransaction?: (transaction_id: null | number) => void;
    active_transaction_id?: number | null;
};

/**
 * KSH-aware money display.
 * When the user's display currency is KSH we convert the USD amount using
 * fromUsd() and label it KSH.  Otherwise we fall back to the standard
 * Money component so formatting / rounding stays consistent.
 */
const KshMoney: React.FC<{
    amount: number;
    contractCurrency: string;
    showCurrency?: boolean;
    className?: string;
}> = ({ amount, contractCurrency, showCurrency = false, className }) => {
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);

    if (displayCur === 'USD' || displayCur === contractCurrency) {
        return (
            <Money
                amount={amount}
                currency={contractCurrency}
                show_currency={showCurrency}
                className={className}
            />
        );
    }
    // KSH (or other non-USD display) mode — convert + label
    const converted = fromUsd(amount);
    const formatted = converted.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (
        <span className={className}>
            {formatted}{showCurrency ? ` ${displayCur}` : ''}
        </span>
    );
};

const TransactionIconWithText = ({ icon, title, message, className }: TTransactionIconWithText) => (
    <React.Fragment>
        <Popover
            className={classNames(className, 'transactions__icon')}
            alignment={isDbotRTL() ? 'right' : 'left'}
            message={title}
            zIndex={popover_zindex.TRANSACTION.toString()}
        >
            {icon}
        </Popover>
        {message}
    </React.Fragment>
);

const TransactionFieldLoader = () => (
    <ContentLoader
        className='transactions__loader-text'
        height={10}
        width={80}
        speed={3}
        backgroundColor={'var(--general-section-2)'}
        foregroundColor={'var(--general-hover)'}
    >
        <rect x='0' y='0' rx='0' ry='0' width='100' height='12' />
    </ContentLoader>
);

const TransactionIconLoader = () => (
    <ContentLoader
        className='transactions__loader-icon'
        speed={3}
        width={24}
        height={24}
        backgroundColor={'var(--general-section-1)'}
        foregroundColor={'var(--general-hover)'}
    >
        <rect x='0' y='0' rx='5' ry='5' width='24' height='24' />
    </ContentLoader>
);

const PopoverItem = ({ icon, title, children }: TPopoverItem) => (
    <div className='transactions__popover-item'>
        {icon && <div className='transaction__popover-icon'>{icon}</div>}
        <div className='transactions__popover-details'>
            <div className='transactions__popover-title'>{title}</div>
            {children}
        </div>
    </div>
);

const PopoverContent = ({ contract }: TPopoverContent) => (
    <div className='transactions__popover-content'>
        {contract.transaction_ids && (
            <PopoverItem title={<Localize i18n_default_text='Reference IDs' />}>
                {contract.transaction_ids.buy && (
                    <div className='transactions__popover-value'>
                        {`${contract.transaction_ids.buy} ${localize('(Buy)')}`}
                    </div>
                )}
                {contract.transaction_ids.sell && (
                    <div className='transactions__popover-value'>
                        {`${contract.transaction_ids.sell} ${localize('(Sell)')}`}
                    </div>
                )}
            </PopoverItem>
        )}
        {(contract as any).batch_id && (
            <PopoverItem title={localize('Batch execution')}>
                <div className='transactions__popover-value'>
                    {(contract as any).batch_id}
                </div>
                <div className='transactions__popover-value'>
                    {`Position ${(contract as any).batch_index || 1}/${(contract as any).batch_size || 1} · ${((contract as any).execution_mode || 'single') === 'parallel' ? 'Parallel' : 'Single Trade'}`}
                </div>
            </PopoverItem>
        )}
        {contract.tick_count && (
            <PopoverItem title={localize('Duration')}>
                <div className='transactions__popover-value'>{`${contract.tick_count} ${localize('ticks')}`}</div>
            </PopoverItem>
        )}
        {(contract.barrier && (
            <PopoverItem title={localize('Barrier')}>
                <div className='transactions__popover-value'>{contract.barrier}</div>
            </PopoverItem>
        )) ||
            (contract.high_barrier && contract.low_barrier && (
                <PopoverItem title={localize('Barriers')}>
                    <div className='transactions__popover-value'>{`${contract.high_barrier} ${localize(
                        '(High)'
                    )}`}</div>
                    <div className='transactions__popover-value'>{`${contract.low_barrier} ${localize('(Low)')}`}</div>
                </PopoverItem>
            ))}
        {contract.date_start && (
            <PopoverItem title={localize('Start time')}>
                <div className='transactions__popover-value'>
                    {convertDateFormat(contract.date_start, 'YYYY-M-D HH:mm:ss [GMT]', 'YYYY-MM-DD HH:mm:ss [GMT]')}
                </div>
            </PopoverItem>
        )}
        {contract.entry_spot && (
            <PopoverItem title={localize('Entry spot')}>
                <div className='transactions__popover-value'>{contract.entry_spot}</div>
                {contract.entry_tick_time && (
                    <div className='transactions__popover-value'>
                        {convertDateFormat(
                            contract.entry_tick_time,
                            'YYYY-M-D HH:mm:ss [GMT]',
                            'YYYY-MM-DD HH:mm:ss [GMT]'
                        )}
                    </div>
                )}
            </PopoverItem>
        )}
        {(contract.exit_spot && contract.exit_tick_time && (
            <PopoverItem title={localize('Exit spot')}>
                <div className='transactions__popover-value'>{contract.exit_spot}</div>
                <div className='transactions__popover-value'>
                    {convertDateFormat(contract.exit_tick_time, 'YYYY-M-D HH:mm:ss [GMT]', 'YYYY-MM-DD HH:mm:ss [GMT]')}
                </div>
            </PopoverItem>
        )) ||
            (contract.exit_spot && (
                <PopoverItem title={localize('Exit time')}>
                    <div className='transactions__popover-value'>{contract.exit_spot}</div>
                </PopoverItem>
            ))}
    </div>
);

const Transaction = ({ contract, active_transaction_id, onClickTransaction }: TTransaction) => {
    const isHook = Boolean((contract as any)?.is_virtual_hook);
    const hookWon = (contract as any)?.hook_result === 'profit';
    const hookLabel = hookWon ? '✓ HOOK PROFIT' : '✗ HOOK LOSS';
    return (
        <Popover
            zIndex={popover_zindex.TRANSACTION.toString()}
            alignment={isDbotRTL() ? 'right' : 'left'}
            className='transactions__item-wrapper'
            is_open={!!(contract && active_transaction_id === contract?.transaction_ids?.buy)}
            message={contract && <PopoverContent contract={contract} />}
        >
            <div
                data-testid='dt_transactions_item'
                className='transactions__item'
                onClick={() => onClickTransaction && onClickTransaction(contract?.transaction_ids?.buy || null)}
            >
                <div className={classNames('transactions__cell transactions__trade-type', { 'transactions__hook': isHook })}>
                    <div className='transactions__loader-container'>
                        {contract ? (
                            <TransactionIconWithText
                                icon={
                                    <MarketIcon
                                        type={(contract as any).underlying_symbol || (contract as any).underlying}
                                    />
                                }
                                title={
                                    contract.display_name ||
                                    getSymbolDisplayNameSync(
                                        (contract as any).underlying_symbol || (contract as any).underlying || ''
                                    )
                                }
                            />
                        ) : (
                            <TransactionIconLoader />
                        )}
                    </div>
                    <div className='transactions__loader-container'>
                        {contract ? (
                            isHook ? <span className='transactions__hook-label'>🔮 HOOK</span> : (
                                <TransactionIconWithText
                                    icon={<TradeTypeIcon type={contract.contract_type || ''} size='sm' />}
                                    title={getContractTypeName(contract)}
                                />
                            )
                        ) : (
                            <TransactionIconLoader />
                        )}
                    </div>
                </div>
                <div className='transactions__cell transactions__entry-spot'>
                    <TransactionIconWithText
                        icon={<LegacyRadioOnIcon height={10} width={10} />}
                        title={localize('Entry spot')}
                        message={contract?.entry_spot ?? <TransactionFieldLoader />}
                    />
                </div>
                <div className='transactions__cell transactions__exit-spot'>
                    <TransactionIconWithText
                        icon={<LegacyRadioOffIcon height={10} width={10} />}
                        title={localize('Exit spot')}
                        message={contract?.exit_spot ?? <TransactionFieldLoader />}
                    />
                </div>
                <div className='transactions__cell transactions__stake'>
                    {isHook ? '—' : contract ? (
                        <KshMoney
                            amount={contract.buy_price}
                            contractCurrency={contract.currency}
                            showCurrency
                        />
                    ) : (
                        <TransactionFieldLoader />
                    )}
                </div>
                <div className='transactions__cell transactions__profit'>
                    {isHook ? (
                        <div className={hookWon ? 'transactions__profit--win transactions__hook-result' : 'transactions__profit--loss transactions__hook-result'}>
                            {hookLabel}
                        </div>
                    ) : contract?.is_completed ? (
                        <div
                            className={classNames({
                                'transactions__profit--win': contract?.profit && contract?.profit >= 0,
                                'transactions__profit--loss': contract?.profit && contract?.profit < 0,
                            })}
                        >
                            <KshMoney
                                amount={Math.abs(contract.profit || 0)}
                                contractCurrency={contract.currency}
                                showCurrency
                            />
                        </div>
                    ) : (
                        <TransactionFieldLoader />
                    )}
                </div>
            </div>
        </Popover>
    );
};

export default Transaction;
