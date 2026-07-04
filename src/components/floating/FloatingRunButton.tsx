import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import SpeedControl from '@/components/speed-control/speed-control';
import { useStore } from '@/hooks/useStore';
import './floating-run-button.scss';

const FloatingRunButton: React.FC = observer(() => {
    const { run_panel, dashboard } = useStore();
    const { is_running, onRunButtonClick, onStopButtonClick } = run_panel as any;
    const { active_tab } = dashboard;
    const [collapsed, setCollapsed] = useState(false);

    if (active_tab === 0) return null;

    return (
        <div className={`floating-run-btn ${collapsed ? 'collapsed' : ''}`}>
            {!collapsed && (
                <div className='floating-run-btn__info'>
                    <span className={`floating-run-btn__status ${is_running ? 'running' : 'idle'}`}>
                        {is_running ? '● BOT RUNNING' : '○ Bot Idle'}
                    </span>
                    <SpeedControl className='floating-run-btn__speed' compact />
                </div>
            )}
            <div className='floating-run-btn__actions'>
                <button
                    className={`floating-run-btn__btn ${is_running ? 'stop' : 'run'}`}
                    onClick={() => is_running ? onStopButtonClick() : onRunButtonClick()}
                    title={is_running ? 'Stop bot' : 'Run bot'}
                >
                    {is_running ? '⏹' : '▶'}
                </button>
                <button
                    className='floating-run-btn__collapse'
                    onClick={() => setCollapsed(c => !c)}
                    title={collapsed ? 'Expand' : 'Collapse'}
                >
                    {collapsed ? '◀' : '▶'}
                </button>
            </div>
        </div>
    );
});

export default FloatingRunButton;
