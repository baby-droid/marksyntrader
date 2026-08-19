import React, { useState, useRef, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import './nav-drawer.scss';

const NAV_ITEMS = [
    { tab: DBOT_TABS.DASHBOARD,      icon: '🏠', label: 'Dashboard' },
    { tab: DBOT_TABS.AHMED_LEARNING, icon: '🧱', label: 'Bot Builder' },
    { tab: DBOT_TABS.FREE_BOTS,           icon: '🤖', label: 'Free Bots' },
    { tab: DBOT_TABS.AHMED_SCALPER_BOTS, icon: '⚡', label: 'Scalper Bots' },
    { tab: DBOT_TABS.DCIRCLES,           icon: '⬤',  label: 'D-Circles' },
    { tab: DBOT_TABS.SPEEDLAB,       icon: '⚡',  label: 'Speed Lab' },
    { tab: DBOT_TABS.HEDGE,          icon: '🔀', label: 'Hedge Trading' },
    { tab: DBOT_TABS.CHART,          icon: '📈', label: 'Charts' },
    { tab: DBOT_TABS.MANUAL_TRADER,  icon: '🎯', label: 'Manual Trader' },
    { tab: DBOT_TABS.AUTO_TRADES,    icon: '🔄', label: 'Auto Trades' },
    { tab: DBOT_TABS.COPY_TRADING,   icon: '📋', label: 'Copy Trading' },
    { tab: DBOT_TABS.REPORT,         icon: '📄', label: 'Reports' },
    { tab: DBOT_TABS.BULK_TRADE,     icon: '📦', label: 'Bulk Trade' },
    { tab: DBOT_TABS.ANALYSIS,       icon: '🔍', label: 'Analysis' },
    { tab: DBOT_TABS.TUTORIAL,       icon: '📚', label: 'Tutorials' },
    { tab: DBOT_TABS.TRADING_SOFTWARE, icon: '💻', label: 'Trading Software' },
];

const NavDrawer: React.FC = observer(() => {
    const store = useStore();
    const [open, setOpen] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);

    const active_tab: number = store?.dashboard?.active_tab ?? 0;
    const setActiveTab = store?.dashboard?.setActiveTab;

    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) close();
        };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', esc);
        };
    }, [open, close]);

    const goTo = useCallback((tab: number) => {
        if (setActiveTab) setActiveTab(tab);
        close();
    }, [setActiveTab, close]);

    return (
        <div className='nav-drawer' ref={drawerRef}>
            <button
                className={`nav-drawer__toggle ${open ? 'nav-drawer__toggle--open' : ''}`}
                onClick={() => setOpen(o => !o)}
                title='Navigation Menu'
                aria-label='Open navigation'
            >
                <span /><span /><span />
            </button>

            {open && (
                <div className='nav-drawer__panel'>
                    <div className='nav-drawer__header'>
                        <span className='nav-drawer__brand'>⚡ AHMED TRADE</span>
                        <button className='nav-drawer__close' onClick={close}>✕</button>
                    </div>
                    <nav className='nav-drawer__list'>
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.tab}
                                className={`nav-drawer__item ${active_tab === item.tab ? 'nav-drawer__item--active' : ''}`}
                                onClick={() => goTo(item.tab)}
                            >
                                <span className='nav-drawer__item-icon'>{item.icon}</span>
                                <span className='nav-drawer__item-label'>{item.label}</span>
                                {active_tab === item.tab && <span className='nav-drawer__item-dot' />}
                            </button>
                        ))}
                    </nav>
                    <div className='nav-drawer__footer'>
                        <span>Ahmed Syn Trader</span>
                        <span className='nav-drawer__footer-ver'>v2.0</span>
                    </div>
                </div>
            )}
        </div>
    );
});

export default NavDrawer;
