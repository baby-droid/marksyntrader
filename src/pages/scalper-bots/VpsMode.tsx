// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './vps-mode.scss';

export interface VpsSettings {
    numRuns: number;      // 0 = unlimited
    takeProfit: number;
    stopLoss: number;
}

export interface VpsState {
    enabled: boolean;
    settings: VpsSettings;
    runs: number;
    pnl: number;
    done: boolean;
    doneReason: string;
}

interface VpsStatusInfo {
    accountOk: boolean;
    internetOk: boolean;
    terminalAlive: boolean;
    speed: number;
}

interface VpsModeProps {
    enabled: boolean;
    settings: VpsSettings;
    running: boolean;
    authorized: boolean;
    lastTickAtRef: React.MutableRefObject<number>;
    sessionPnlRef: React.MutableRefObject<number>;
    vpsRuns: number;
    vpsPnl: number;
    onToggle: (enabled: boolean) => void;
    onSettingsChange: (s: VpsSettings) => void;
    onRequestRestart: () => void;
    onDone: (reason: string) => void;
}

const VpsMode: React.FC<VpsModeProps> = ({
    enabled, settings, running, authorized,
    lastTickAtRef, sessionPnlRef,
    vpsRuns, vpsPnl,
    onToggle, onSettingsChange, onRequestRestart, onDone,
}) => {
    const [log, setLog]               = useState<{ t: string; msg: string; kind: string }[]>([]);
    const [status, setStatus]         = useState<VpsStatusInfo>({ accountOk: false, internetOk: true, terminalAlive: true, speed: 0 });
    const [showSettings, setShowSettings] = useState(false);
    const [settingsDraft, setSettingsDraft] = useState(settings);
    const [minimized, setMinimized]   = useState(false);
    const logRef                      = useRef<HTMLDivElement>(null);
    const pingRef                     = useRef<ReturnType<typeof setInterval> | null>(null);
    const prevRunningRef              = useRef(running);
    const restartPendingRef           = useRef(false);
    const doneRef                     = useRef(false);

    const ts = () => new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const addLog = useCallback((msg: string, kind = 'info') => {
        setLog(prev => [{ t: ts(), msg, kind }, ...prev].slice(0, 150));
    }, []);

    /* ─── Periodic health check ─── */
    useEffect(() => {
        if (!enabled) {
            if (pingRef.current) clearInterval(pingRef.current);
            return;
        }
        doneRef.current = false;

        const check = async () => {
            const accountOk = authorized;
            let internetOk  = true;
            let speed       = 0;

            /* measure ping via timing a small fetch (best-effort) */
            try {
                const t0 = performance.now();
                await fetch('https://api.derivws.com/trading/v1/options/ws/public', { method: 'HEAD', mode: 'no-cors' });
                speed = Math.round(performance.now() - t0);
            } catch { internetOk = false; speed = 9999; }

            const terminalAlive = Date.now() - lastTickAtRef.current < 40_000;
            setStatus({ accountOk, internetOk, terminalAlive, speed });

            if (!accountOk) addLog('⚠ ACCOUNT_DISCONNECTED — waiting for reconnect...', 'error');
            if (!internetOk) addLog('🌐 NETWORK_LOST — reconnection pending...', 'error');
            if (!terminalAlive && running) addLog('⚠ TERMINAL_STALL: no tick in 40s — forcing restart...', 'error');
        };

        check();
        pingRef.current = setInterval(check, 10_000);
        return () => { if (pingRef.current) clearInterval(pingRef.current); };
    }, [enabled, authorized, running, lastTickAtRef, addLog]);

    /* ─── Auto-restart logic ─── */
    useEffect(() => {
        if (!enabled) return;

        const wasRunning = prevRunningRef.current;
        prevRunningRef.current = running;

        if (wasRunning && !running && !doneRef.current && !restartPendingRef.current) {
            /* Bot just stopped — check VPS limits before restarting */
            const nextRuns = vpsRuns + 1;
            const pnl = vpsPnl;

            const tpHit = settings.takeProfit > 0 && pnl >= settings.takeProfit;
            const slHit = settings.stopLoss > 0 && pnl <= -Math.abs(settings.stopLoss);
            const runsHit = settings.numRuns > 0 && nextRuns > settings.numRuns;

            if (tpHit || slHit || runsHit) {
                doneRef.current = true;
                const reason = tpHit ? `Take Profit $${settings.takeProfit} reached` : slHit ? `Stop Loss -$${settings.stopLoss} hit` : `${settings.numRuns} runs completed`;
                addLog(`🏁 VPS_DONE: ${reason}`, 'stop');
                addLog(`   Total P/L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USD over ${nextRuns - 1} runs`, 'info');
                onDone(reason);
                return;
            }

            /* Schedule restart */
            restartPendingRef.current = true;
            const delay = 1500;
            addLog(`🔄 VPS_AUTO_RESTART in ${delay / 1000}s (run #${nextRuns}${settings.numRuns > 0 ? '/' + settings.numRuns : ''})`, 'restart');
            setTimeout(() => {
                restartPendingRef.current = false;
                if (!doneRef.current && enabled) {
                    addLog('▶ VPS: RESTARTING TERMINAL LOG...', 'restart');
                    onRequestRestart();
                }
            }, delay);
        }
    }, [running, enabled, vpsRuns, vpsPnl, settings, addLog, onRequestRestart, onDone]);

    /* ─── Startup log ─── */
    useEffect(() => {
        if (enabled) {
            doneRef.current = false;
            addLog('🟢 VPS MODE: ACTIVATED', 'start');
            addLog(`   Runs: ${settings.numRuns > 0 ? settings.numRuns : '∞'}  |  TP: $${settings.takeProfit}  |  SL: $${settings.stopLoss}`, 'info');
        } else {
            addLog('🔴 VPS MODE: DEACTIVATED', 'stop');
        }
    }, [enabled]); // eslint-disable-line

    const saveSettings = () => {
        onSettingsChange(settingsDraft);
        setShowSettings(false);
        addLog(`⚙ VPS_SETTINGS updated — Runs:${settingsDraft.numRuns || '∞'} TP:$${settingsDraft.takeProfit} SL:$${settingsDraft.stopLoss}`, 'info');
    };

    const StatusDot = ({ ok }: { ok: boolean }) => (
        <span className={`vps-status-dot ${ok ? 'ok' : 'err'}`} />
    );

    return (
        <div className={`vps-panel${minimized ? ' minimized' : ''}${enabled ? ' active' : ''}`}>
            {/* Header */}
            <div className='vps-panel__hdr'>
                <div className='vps-panel__hdr-left'>
                    <span className='vps-panel__title'>⚡ VPS MODE</span>
                    <span className={`vps-panel__badge ${enabled ? 'on' : 'off'}`}>{enabled ? 'ON' : 'OFF'}</span>
                </div>
                <div className='vps-panel__hdr-right'>
                    <button className='vps-panel__settings-btn' onClick={() => setShowSettings(v => !v)} title='VPS Settings'>⚙</button>
                    <button className={`vps-panel__toggle-btn ${enabled ? 'active' : ''}`} onClick={() => onToggle(!enabled)}>
                        {enabled ? 'DISABLE' : 'ENABLE'}
                    </button>
                    <button className='vps-panel__min-btn' onClick={() => setMinimized(v => !v)}>{minimized ? '▲' : '▼'}</button>
                </div>
            </div>

            {!minimized && (
                <>
                    {/* Stats row */}
                    <div className='vps-panel__stats'>
                        <div className='vps-stat'>
                            <span>Runs</span>
                            <strong>{vpsRuns}{settings.numRuns > 0 ? `/${settings.numRuns}` : ''}</strong>
                        </div>
                        <div className={`vps-stat ${vpsPnl >= 0 ? 'green' : 'red'}`}>
                            <span>P/L</span>
                            <strong>{vpsPnl >= 0 ? '+' : ''}{vpsPnl.toFixed(2)}</strong>
                        </div>
                        <div className='vps-stat'>
                            <span>TP</span>
                            <strong>${settings.takeProfit > 0 ? settings.takeProfit : '—'}</strong>
                        </div>
                        <div className='vps-stat'>
                            <span>SL</span>
                            <strong>${settings.stopLoss > 0 ? settings.stopLoss : '—'}</strong>
                        </div>
                    </div>

                    {/* Status indicators */}
                    <div className='vps-panel__status-row'>
                        <span className='vps-status-item'>
                            <StatusDot ok={status.accountOk} />
                            <span>Account</span>
                        </span>
                        <span className='vps-status-item'>
                            <StatusDot ok={status.internetOk} />
                            <span>Network</span>
                        </span>
                        <span className='vps-status-item'>
                            <StatusDot ok={status.terminalAlive} />
                            <span>Terminal</span>
                        </span>
                        <span className='vps-status-item speed'>
                            <span className={`vps-speed ${status.speed < 200 ? 'ok' : status.speed < 500 ? 'warn' : 'err'}`}>
                                {status.speed > 0 ? `${status.speed}ms` : '—'}
                            </span>
                        </span>
                    </div>

                    {/* VPS terminal log */}
                    <div className='vps-panel__log' ref={logRef}>
                        {log.length === 0 ? (
                            <div className='vps-panel__log-idle'>{enabled ? '> Monitoring...' : '> VPS inactive'}</div>
                        ) : log.map((e, i) => (
                            <div key={i} className={`vps-log-line ${e.kind}`}>
                                <span className='vps-log-ts'>{e.t}</span>
                                {e.msg}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Settings modal */}
            {showSettings && (
                <div className='vps-settings-overlay' onClick={() => setShowSettings(false)}>
                    <div className='vps-settings-modal' onClick={e => e.stopPropagation()}>
                        <div className='vps-settings-modal__title'>⚙ VPS Settings</div>
                        <div className='vps-settings-modal__field'>
                            <label>Number of Runs <span className='vps-hint'>(0 = unlimited)</span></label>
                            <input type='number' min={0} max={1000} value={settingsDraft.numRuns}
                                onChange={e => setSettingsDraft(v => ({ ...v, numRuns: Math.max(0, parseInt(e.target.value) || 0) }))} />
                        </div>
                        <div className='vps-settings-modal__field'>
                            <label>Take Profit ($) <span className='vps-hint'>(0 = disabled)</span></label>
                            <input type='number' min={0} step={1} value={settingsDraft.takeProfit}
                                onChange={e => setSettingsDraft(v => ({ ...v, takeProfit: Math.max(0, parseFloat(e.target.value) || 0) }))} />
                        </div>
                        <div className='vps-settings-modal__field'>
                            <label>Stop Loss ($) <span className='vps-hint'>(0 = disabled)</span></label>
                            <input type='number' min={0} step={1} value={settingsDraft.stopLoss}
                                onChange={e => setSettingsDraft(v => ({ ...v, stopLoss: Math.max(0, parseFloat(e.target.value) || 0) }))} />
                        </div>
                        <div className='vps-settings-modal__btns'>
                            <button className='vps-settings-modal__save' onClick={saveSettings}>Save</button>
                            <button className='vps-settings-modal__cancel' onClick={() => setShowSettings(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VpsMode;
