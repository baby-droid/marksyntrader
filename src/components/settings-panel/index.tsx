// @ts-nocheck
import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import useThemeSwitcher from '@/hooks/useThemeSwitcher';
import { DBOT_TABS } from '@/constants/bot-contents';
import './settings-panel.scss';

interface SettingsPanelProps {
  onTabChange?: (index: number) => void;
  currentTab?: number;
}

const NAV_ITEMS = [
  { tab: DBOT_TABS.FREE_BOTS,     icon: '🤖', label: 'Free Bots' },
  { tab: DBOT_TABS.DASHBOARD,     icon: '🏠', label: 'Dashboard' },
  { tab: DBOT_TABS.BOT_BUILDER,   icon: '🧩', label: 'Bot Builder' },
  { tab: DBOT_TABS.DCIRCLES,      icon: '⭕', label: 'DCircles' },
  { tab: DBOT_TABS.SPEED_LAB,     icon: '⚡', label: 'Speed Lab' },
  { tab: DBOT_TABS.PRO_HEDGE,     icon: '⚖', label: 'Pro Hedge' },
  { tab: DBOT_TABS.CHART,         icon: '📈', label: 'Charts' },
  { tab: DBOT_TABS.MANUAL_TRADER, icon: '🖐', label: 'Manual Trader' },
  { tab: DBOT_TABS.TUTORIAL,      icon: '📚', label: 'Tutorials' },
  { tab: DBOT_TABS.BOT_LIBRARY,   icon: '📦', label: 'Bot Library' },
  { tab: DBOT_TABS.COPY_TRADING,  icon: '🔄', label: 'Copy Trading' },
  { tab: DBOT_TABS.REPORTS,       icon: '📊', label: 'Reports' },
];

const SettingsPanel = observer(({ onTabChange, currentTab }: SettingsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'nav' | 'settings'>('settings');
  const { is_dark_mode_on, toggleTheme } = useThemeSwitcher();
  const store = useStore();

  const handleTabNavigate = (tab: number) => {
    if (onTabChange) {
      onTabChange(tab);
    } else if (store?.dashboard?.setActiveTab) {
      store.dashboard.setActiveTab(tab);
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Gear button */}
      <button
        className='settings-panel__trigger'
        onClick={() => setIsOpen(true)}
        title='Settings & Navigation'
        aria-label='Settings'
      >
        ⚙
      </button>

      {/* Overlay + Drawer */}
      {isOpen && (
        <div className='settings-panel__overlay' onClick={() => setIsOpen(false)}>
          <div className='settings-panel__drawer' onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className='settings-panel__header'>
              <div className='settings-panel__header-tabs'>
                <button
                  className={`settings-panel__header-tab ${activeSection === 'settings' ? 'active' : ''}`}
                  onClick={() => setActiveSection('settings')}
                >
                  Settings
                </button>
                <button
                  className={`settings-panel__header-tab ${activeSection === 'nav' ? 'active' : ''}`}
                  onClick={() => setActiveSection('nav')}
                >
                  Navigate
                </button>
              </div>
              <button className='settings-panel__close' onClick={() => setIsOpen(false)}>✕</button>
            </div>

            {/* Settings section */}
            {activeSection === 'settings' && (
              <div className='settings-panel__body'>
                <div className='settings-panel__group'>
                  <h4>APPEARANCE</h4>
                  <div className='settings-panel__row'>
                    <div className='settings-panel__row-icon'>
                      {is_dark_mode_on ? '🌙' : '☀️'}
                    </div>
                    <div className='settings-panel__row-text'>
                      <strong>Dark theme</strong>
                      <span>{is_dark_mode_on ? 'Dark mode on' : 'Light mode on'}</span>
                    </div>
                    <label className='settings-panel__toggle'>
                      <input
                        type='checkbox'
                        checked={is_dark_mode_on}
                        onChange={toggleTheme}
                      />
                      <span className='settings-panel__toggle-slider' />
                    </label>
                  </div>
                </div>

                <div className='settings-panel__group'>
                  <h4>TRADING</h4>
                  <div className='settings-panel__row'>
                    <div className='settings-panel__row-icon'>⚡</div>
                    <div className='settings-panel__row-text'>
                      <strong>Fast execution</strong>
                      <span>Ultra-fast contract placement</span>
                    </div>
                    <label className='settings-panel__toggle'>
                      <input type='checkbox' defaultChecked />
                      <span className='settings-panel__toggle-slider' />
                    </label>
                  </div>
                  <div className='settings-panel__row'>
                    <div className='settings-panel__row-icon'>🔔</div>
                    <div className='settings-panel__row-text'>
                      <strong>Trade alerts</strong>
                      <span>Notify on win/loss</span>
                    </div>
                    <label className='settings-panel__toggle'>
                      <input type='checkbox' defaultChecked />
                      <span className='settings-panel__toggle-slider' />
                    </label>
                  </div>
                </div>

                <div className='settings-panel__group'>
                  <h4>DISPLAY</h4>
                  <div className='settings-panel__row'>
                    <div className='settings-panel__row-icon'>📊</div>
                    <div className='settings-panel__row-text'>
                      <strong>Show digit % on circles</strong>
                      <span>Display percentage inside circles</span>
                    </div>
                    <label className='settings-panel__toggle'>
                      <input type='checkbox' defaultChecked />
                      <span className='settings-panel__toggle-slider' />
                    </label>
                  </div>
                  <div className='settings-panel__row'>
                    <div className='settings-panel__row-icon'>🎯</div>
                    <div className='settings-panel__row-text'>
                      <strong>Cursor tracker</strong>
                      <span>Animated ring on current digit</span>
                    </div>
                    <label className='settings-panel__toggle'>
                      <input type='checkbox' defaultChecked />
                      <span className='settings-panel__toggle-slider' />
                    </label>
                  </div>
                </div>

                <div className='settings-panel__version'>
                  Marksyntrader v2.0 · Built on Deriv Bot
                </div>
              </div>
            )}

            {/* Navigation section */}
            {activeSection === 'nav' && (
              <div className='settings-panel__body'>
                <div className='settings-panel__group'>
                  <h4>PAGES</h4>
                  <div className='settings-panel__nav-grid'>
                    {NAV_ITEMS.map(item => (
                      <button
                        key={item.tab}
                        className={`settings-panel__nav-btn ${currentTab === item.tab ? 'active' : ''}`}
                        onClick={() => handleTabNavigate(item.tab)}
                      >
                        <span className='settings-panel__nav-icon'>{item.icon}</span>
                        <span className='settings-panel__nav-label'>{item.label}</span>
                        {currentTab === item.tab && <span className='settings-panel__nav-active-dot' />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});

export default SettingsPanel;
