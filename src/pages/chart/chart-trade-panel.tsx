// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { fromUsd, getDisplayCurrency } from '@/utils/currency-display';
import api_base from '@/external/bot-skeleton/services/api/api-base';

type TradeCategory = 'options' | 'multipliers' | 'accumulators';
type SubType = string;

interface ParamDef { label: string; type: 'number' | 'select'; min?: number; step?: number; options?: string[]; default?: number | string }

const CATEGORIES: { id: TradeCategory; label: string; icon: string }[] = [
    { id: 'options',      label: 'Options',      icon: '📊' },
    { id: 'multipliers',  label: 'Multipliers',  icon: '✖️' },
    { id: 'accumulators', label: 'Accumulators', icon: '📈' },
];

const SUBTYPES: Record<TradeCategory, { id: string; label: string; contractType: string[] }[]> = {
    options: [
        { id: 'rise_fall',    label: 'Rise / Fall',    contractType: ['CALL', 'PUT'] },
        { id: 'higher_lower', label: 'Higher / Lower',  contractType: ['CALL_BARRIER', 'PUT_BARRIER'] },
        { id: 'even_odd',     label: 'Even / Odd',      contractType: ['DIGITEVEN', 'DIGITODD'] },
        { id: 'matches_differs', label: 'Matches / Differs', contractType: ['DIGITMATCH', 'DIGITDIFF'] },
        { id: 'over_under',   label: 'Over / Under',    contractType: ['DIGITOVER', 'DIGITUNDER'] },
    ],
    multipliers: [
        { id: 'multiplier', label: 'Multipliers', contractType: ['MULTUP', 'MULTDOWN'] },
    ],
    accumulators: [
        { id: 'accu', label: 'Accumulators', contractType: ['ACCU'] },
    ],
};

const PARAMS: Record<string, ParamDef[]> = {
    rise_fall:       [{ label: 'Duration (ticks)', type: 'number', min: 1, step: 1, default: 5 }, { label: 'Stake', type: 'number', min: 0.35, step: 0.01, default: 1 }],
    higher_lower:    [{ label: 'Duration (ticks)', type: 'number', min: 1, step: 1, default: 5 }, { label: 'Stake', type: 'number', min: 0.35, step: 0.01, default: 1 }, { label: 'Barrier', type: 'number', min: 0, step: 0.01, default: 0 }],
    even_odd:        [{ label: 'Duration (ticks)', type: 'number', min: 1, step: 1, default: 5 }, { label: 'Stake', type: 'number', min: 0.35, step: 0.01, default: 1 }],
    matches_differs: [{ label: 'Duration (ticks)', type: 'number', min: 1, step: 1, default: 5 }, { label: 'Stake', type: 'number', min: 0.35, step: 0.01, default: 1 }, { label: 'Digit', type: 'number', min: 0, step: 1, default: 5 }],
    over_under:      [{ label: 'Duration (ticks)', type: 'number', min: 1, step: 1, default: 5 }, { label: 'Stake', type: 'number', min: 0.35, step: 0.01, default: 1 }, { label: 'Barrier', type: 'number', min: 0, step: 1, default: 4 }],
    multiplier:      [{ label: 'Multiplier', type: 'select', options: ['2','5','10','20','50','100'], default: '10' }, { label: 'Stake', type: 'number', min: 1, step: 1, default: 10 }, { label: 'Take Profit', type: 'number', min: 0, step: 1, default: 0 }],
    accu:            [{ label: 'Growth Rate', type: 'select', options: ['1','2','3','4','5'], default: '1' }, { label: 'Stake', type: 'number', min: 1, step: 1, default: 10 }, { label: 'Take Profit', type: 'number', min: 0, step: 1, default: 0 }],
};

const CONTRACT_TYPE_UP: Record<string, string> = {
    rise_fall: 'CALL', higher_lower: 'CALL', even_odd: 'DIGITEVEN',
    matches_differs: 'DIGITMATCH', over_under: 'DIGITOVER',
    multiplier: 'MULTUP', accu: 'ACCU',
};
const CONTRACT_TYPE_DOWN: Record<string, string> = {
    rise_fall: 'PUT', higher_lower: 'PUT', even_odd: 'DIGITODD',
    matches_differs: 'DIGITDIFF', over_under: 'DIGITUNDER',
    multiplier: 'MULTDOWN', accu: 'ACCU',
};

export const ChartTradePanel: React.FC<{ symbol: string }> = ({ symbol }) => {
    const [category,  setCategory]  = useState<TradeCategory>('options');
    const [subType,   setSubType]   = useState<SubType>('rise_fall');
    const [params,    setParams]    = useState<Record<string, string | number>>({
        'Duration (ticks)': 5, 'Stake': 1,
    });
    const [loading, setLoading] = useState<'up' | 'down' | null>(null);
    const [result,  setResult]  = useState<{ ok: boolean; msg: string } | null>(null);

    const handleCategoryChange = (cat: TradeCategory) => {
        setCategory(cat);
        const firstSub = SUBTYPES[cat][0].id;
        setSubType(firstSub);
        const defs = PARAMS[firstSub] || [];
        const defaults: Record<string, string | number> = {};
        defs.forEach(d => { defaults[d.label] = d.default ?? (d.type === 'select' ? d.options![0] : 1); });
        setParams(defaults);
    };

    const handleSubChange = (sub: string) => {
        setSubType(sub);
        const defs = PARAMS[sub] || [];
        const defaults: Record<string, string | number> = {};
        defs.forEach(d => { defaults[d.label] = d.default ?? (d.type === 'select' ? d.options![0] : 1); });
        setParams(defaults);
    };

    const buy = useCallback(async (direction: 'up' | 'down') => {
        if (loading) return;
        setLoading(direction);
        setResult(null);

        const ct = direction === 'up' ? (CONTRACT_TYPE_UP[subType] || 'CALL') : (CONTRACT_TYPE_DOWN[subType] || 'PUT');
        const stake = Number(params['Stake'] ?? 1);
        const duration = Number(params['Duration (ticks)'] ?? 5);
        const multiplier = params['Multiplier'] ? Number(params['Multiplier']) : undefined;
        const barrier = params['Barrier'] !== undefined ? String(params['Barrier']) : undefined;
        const prediction = params['Digit'] !== undefined ? Number(params['Digit']) : undefined;
        const growth_rate = params['Growth Rate'] ? Number(params['Growth Rate']) / 100 : undefined;
        const tp = params['Take Profit'] ? Number(params['Take Profit']) : undefined;

        try {
            const ws = api_base.api;
            if (!ws) throw new Error('Not connected');

            const req: any = {
                buy: 1,
                price: stake,
                parameters: {
                    contract_type: ct,
                    symbol,
                    currency: getDisplayCurrency() || 'USD',
                    basis: 'stake',
                    amount: stake,
                },
            };

            if (['CALL','PUT','CALL_BARRIER','PUT_BARRIER'].includes(ct)) {
                req.parameters.duration_unit = 't';
                req.parameters.duration = duration;
            }
            if (multiplier !== undefined) req.parameters.multiplier = multiplier;
            if (barrier !== undefined) req.parameters.barrier = barrier;
            if (prediction !== undefined) req.parameters.prediction = prediction;
            if (growth_rate !== undefined) req.parameters.growth_rate = growth_rate;
            if (tp) {
                req.parameters.limit_order = { take_profit: tp };
            }

            const resp = await ws.send(req);
            if (resp?.error) throw new Error(resp.error.message);
            const contractId = resp?.buy?.contract_id;
            setResult({ ok: true, msg: `✅ Contract #${contractId} bought` });
        } catch (e: any) {
            setResult({ ok: false, msg: `❌ ${e.message}` });
        } finally {
            setLoading(null);
            setTimeout(() => setResult(null), 4000);
        }
    }, [loading, subType, params, symbol]);

    const paramDefs = PARAMS[subType] || [];
    const showDirectional = !['accu'].includes(subType);
    const upLabel   = { rise_fall: 'Rise', higher_lower: 'Higher', even_odd: 'Even', matches_differs: 'Matches', over_under: 'Over',  multiplier: 'Up',   accu: 'Buy' }[subType] ?? 'Up';
    const downLabel = { rise_fall: 'Fall', higher_lower: 'Lower',  even_odd: 'Odd',  matches_differs: 'Differs', over_under: 'Under', multiplier: 'Down', accu: 'Buy' }[subType] ?? 'Down';

    return (
        <div className='chart-trade-panel'>
            {/* Category tabs */}
            <div className='chart-trade-panel__cats'>
                {CATEGORIES.map(c => (
                    <button key={c.id}
                        className={`chart-trade-panel__cat ${category === c.id ? 'active' : ''}`}
                        onClick={() => handleCategoryChange(c.id)}>
                        <span className='chart-trade-panel__cat-icon'>{c.icon}</span>
                        <span>{c.label}</span>
                    </button>
                ))}
            </div>

            {/* Sub-type list */}
            <div className='chart-trade-panel__subs'>
                {SUBTYPES[category].map(s => (
                    <button key={s.id}
                        className={`chart-trade-panel__sub ${subType === s.id ? 'active' : ''}`}
                        onClick={() => handleSubChange(s.id)}>
                        {s.label}
                    </button>
                ))}
            </div>

            <div className='chart-trade-panel__divider' />

            {/* Parameters */}
            <div className='chart-trade-panel__params'>
                {paramDefs.map(def => (
                    <div key={def.label} className='chart-trade-panel__param'>
                        <label>{def.label}</label>
                        {def.type === 'select' ? (
                            <select value={String(params[def.label] ?? def.options![0])}
                                onChange={e => setParams(p => ({ ...p, [def.label]: e.target.value }))}>
                                {def.options!.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        ) : (
                            <input type='number' min={def.min} step={def.step}
                                value={String(params[def.label] ?? def.default ?? 1)}
                                onChange={e => setParams(p => ({ ...p, [def.label]: e.target.value }))} />
                        )}
                    </div>
                ))}
            </div>

            {/* Result */}
            {result && (
                <div className={`chart-trade-panel__result ${result.ok ? 'ok' : 'err'}`}>{result.msg}</div>
            )}

            {/* Buy buttons */}
            <div className='chart-trade-panel__actions'>
                <button className='chart-trade-panel__buy chart-trade-panel__buy--up'
                    onClick={() => buy('up')} disabled={!!loading}>
                    {loading === 'up' ? '…' : `▲ ${upLabel}`}
                </button>
                {showDirectional && (
                    <button className='chart-trade-panel__buy chart-trade-panel__buy--down'
                        onClick={() => buy('down')} disabled={!!loading}>
                        {loading === 'down' ? '…' : `▼ ${downLabel}`}
                    </button>
                )}
            </div>
        </div>
    );
};

export default ChartTradePanel;
