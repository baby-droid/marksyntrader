import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { fromUsd, subscribeCurrency, toUsd } from '@/utils/currency-display';
import AutoLabView, { type AutoLabSettings } from './AutoLabView';
import type { AutoLabMode } from './auto-lab-engine';
import { useAutoLabEngine } from './useAutoLabEngine';

const INITIAL_SETTINGS: AutoLabSettings = {
    marketSelection: 'ALL',
    contractType: 'AUTO',
    stake: 0.35,
    martingaleMode: 'normal',
    multiplier: 2,
    maxMartingaleLevel: 4,
    takeProfit: 5,
    stopLoss: 5,
    ticksWindow: 100,
    thresholdPercent: 70,
    barrier: 4,
    contractBarrier: 100,
    secondaryBarrier: 101,
    requiredStreak: 3,
    duration: 1,
    durationUnit: 't' as const,
    contractMultiplier: 2,
    growthRate: 0.01,
    barrierRange: 'middle' as const,
    selectedTick: 1,
    virtualLossesRequired: 2,
    virtualWinsRequired: 1,
};

const AutoLab = observer(() => {
    const [mode, setMode] = useState<AutoLabMode>('Multimarket');
    const [settings, setSettings] = useState(INITIAL_SETTINGS);
    const [liveAcknowledged, setLiveAcknowledged] = useState(false);
    const [currencyRevision, setCurrencyRevision] = useState(0);
    const engine = useAutoLabEngine(mode, settings, liveAcknowledged);
    const accountIdentity = `${engine.account.loginId}|${engine.account.isVirtual}`;
    const previousAccountIdentity = useRef(accountIdentity);

    useEffect(() => subscribeCurrency(() => setCurrencyRevision(value => value + 1)), []);
    useEffect(() => {
        if (previousAccountIdentity.current !== accountIdentity) {
            previousAccountIdentity.current = accountIdentity;
            setLiveAcknowledged(false);
        }
    }, [accountIdentity]);

    const displayAmount = (value: number) => Math.round((fromUsd(value) + Number.EPSILON) * 100) / 100;
    const viewSettings = useMemo(() => ({
        ...settings,
        stake: displayAmount(settings.stake),
        takeProfit: displayAmount(settings.takeProfit),
        stopLoss: displayAmount(settings.stopLoss),
    }), [settings, currencyRevision]);

    const onSettingChange = (key: keyof AutoLabSettings, value: string | number) => {
        if (key === 'marketSelection') {
            setSettings(previous => ({ ...previous, marketSelection: String(value) }));
            return;
        }
        if (key === 'contractType') {
            const contractType = String(value) as AutoLabSettings['contractType'];
            const tickOnly = contractType.startsWith('DIGIT')
                || contractType === 'TICKHIGH'
                || contractType === 'TICKLOW';
            setSettings(previous => ({
                ...previous,
                contractType,
                ...(tickOnly ? { durationUnit: 't' as const } : {}),
            }));
            return;
        }
        if (key === 'durationUnit') {
            if (['t', 's', 'm', 'h', 'd'].includes(String(value))) {
                setSettings(previous => ({ ...previous, durationUnit: String(value) as AutoLabSettings['durationUnit'] }));
            }
            return;
        }
        if (key === 'barrierRange') {
            if (['tight', 'middle', 'wide'].includes(String(value))) {
                setSettings(previous => ({ ...previous, barrierRange: value as AutoLabSettings['barrierRange'] }));
            }
            return;
        }
        if (key === 'martingaleMode') {
            if (value === 'normal' || value === 'split') {
                setSettings(previous => ({ ...previous, martingaleMode: value }));
            }
            return;
        }
        const raw = Number(value);
        if (!Number.isFinite(raw)) return;
        const ranges: Partial<Record<keyof AutoLabSettings, [number, number, boolean]>> = {
            stake: [0, 100000, false],
            multiplier: [1, 10, false],
            maxMartingaleLevel: [0, 20, true],
            takeProfit: [0, 1000000, false],
            stopLoss: [0, 1000000, false],
            ticksWindow: [1, 1500, true],
            thresholdPercent: [50, 100, false],
            barrier: [0, 9, true],
            contractBarrier: [0, 1000000000, false],
            secondaryBarrier: [0, 1000000000, false],
            duration: [1, 100000, true],
            requiredStreak: [1, 100, true],
            contractMultiplier: [1, 1000, false],
            growthRate: [0.01, 0.1, false],
            selectedTick: [1, 1000, true],
            virtualLossesRequired: [0, 20, true],
            virtualWinsRequired: [0, 20, true],
        };
        const range = ranges[key];
        if (!range) return;
        const [minimum, maximum, integer] = range;
        const bounded = Math.max(minimum, Math.min(maximum, raw));
        const normalized = integer
            ? Math.round(bounded)
            : Math.round((bounded + Number.EPSILON) * 100) / 100;
        const usdValue = key === 'stake' || key === 'takeProfit' || key === 'stopLoss'
            ? toUsd(normalized)
            : normalized;
        const safeUsdValue = key === 'stake'
            ? Math.max(0.35, Math.round((usdValue + Number.EPSILON) * 100) / 100)
            : usdValue;
        setSettings(previous => ({ ...previous, [key]: safeUsdValue }) as AutoLabSettings);
    };

    const onModeChange = (nextMode: AutoLabMode) => {
        if (
            nextMode === 'Rise/Fall'
            && settings.contractType !== 'AUTO'
            && settings.contractType !== 'CALL'
            && settings.contractType !== 'PUT'
        ) {
            setSettings(previous => ({ ...previous, contractType: 'AUTO' }));
        }
        setMode(nextMode);
    };

    return (
        <AutoLabView
            mode={mode}
            onModeChange={onModeChange}
            settings={viewSettings}
            onSettingChange={onSettingChange}
            account={engine.account}
            status={engine.status}
            currentSignal={engine.currentSignal}
            session={engine.session}
            markets={engine.markets}
            digitStats={engine.digitStats}
            trades={engine.trades}
            liveAcknowledged={liveAcknowledged}
            onLiveAcknowledgedChange={setLiveAcknowledged}
            canStart={engine.canStart}
            inputsDisabled={engine.inputsDisabled}
            onStart={engine.onStart}
            onPause={engine.onPause}
            onStop={engine.onStop}
            message={engine.message}
        />
    );
});

export default AutoLab;