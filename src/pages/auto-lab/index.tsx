import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { useStore } from '@/hooks/useStore';
import { getMasterSource } from '@/utils/trade-bus';
import AutoLabView, { type AutoLabMode, type AutoLabSettings } from './AutoLabView';

const INITIAL_SETTINGS: AutoLabSettings = {
    marketSelection: 'ALL',
    stake: 1,
    martingaleMode: 'normal',
    multiplier: 2,
    maxMartingaleLevel: 4,
    takeProfit: 5,
    stopLoss: 5,
    ticksWindow: 100,
    thresholdPercent: 70,
    barrier: 4,
    requiredStreak: 3,
};

const AutoLab = observer(() => {
    const { connected, authorized, balance, currency } = useDerivTrade();
    const { client } = useStore();
    const [mode, setMode] = useState<AutoLabMode>('Multimarket');
    const [settings, setSettings] = useState(INITIAL_SETTINGS);
    const [liveAcknowledged, setLiveAcknowledged] = useState(false);

    const account = {
        connected,
        authorized,
        isVirtual: authorized ? getMasterSource() === 'demo' : null,
        balance,
        currency,
        loginId: client.loginid || '',
    };

    return (
        <AutoLabView
            mode={mode}
            onModeChange={setMode}
            settings={settings}
            onSettingChange={(key, value) => {
                setSettings(previous => ({ ...previous, [key]: value }) as AutoLabSettings);
            }}
            account={account}
            status='idle'
            currentSignal={{
                label: 'Scanner unavailable',
                detail: 'The synced Auto Lab view has no live scanner or trade executor connected.',
                market: '',
                confidence: null,
            }}
            session={{
                wins: 0,
                losses: 0,
                trades: 0,
                pnl: 0,
                currentStake: settings.stake,
                lossLevel: 0,
            }}
            markets={[]}
            digitStats={[]}
            trades={[]}
            liveAcknowledged={liveAcknowledged}
            onLiveAcknowledgedChange={setLiveAcknowledged}
            canStart={false}
            onStart={() => {}}
            onPause={() => {}}
            onStop={() => {}}
            message='Auto Lab is read-only until its strategy engine is connected. No trades can be placed from this page.'
        />
    );
});

export default AutoLab;