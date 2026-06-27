// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import './free-bots.scss';

// Bot library - in production these would come from the ZIP file
const FREE_BOTS = [
  { id: 'osam-hnr', name: 'Osam HnR 🎯', description: 'Osam even/odd hit-and-run strategy with quick recovery logic.', category: 'Even/Odd', xml: null },
  { id: 'osam-digit-switcher', name: 'Osam Digit Switcher', description: 'Osam over/under bot that switches digit targets automatically.', category: 'Over/Under', xml: null },
  { id: 'osam-digit-switcher-adv', name: 'Osam Digit Switcher 🎯🎯', description: 'Advanced Osam digit switcher for over/under volatility markets.', category: 'Over/Under', xml: null },
  { id: 'osam-digit-ticker', name: 'Osam Digit Ticker', description: 'Osam over/under strategy tuned for digit ticker-style entries.', category: 'Over/Under', xml: null },
  { id: 'tradescript', name: 'TradScript', description: 'Over-digit strategy with Cascade Sniper Athena control and martingale recovery.', category: 'Over/Under', xml: null },
  { id: 'over-under-autobot', name: 'OVER UNDER AUTOBOT', description: 'Fully automated over/under digit trading bot.', category: 'Over/Under', xml: null },
  { id: 'raziel-ou-1', name: 'Raziel Over Under', description: 'Raziel over/under digit strategy with martingale recovery.', category: 'Over/Under', xml: null },
  { id: 'raziel-ou-2', name: 'Raziel Over Under', description: 'Raziel over/under variant with scaled stake management.', category: 'Over/Under', xml: null },
  { id: 'raziel-scaling', name: 'Raziel Scaling', description: 'Raziel over/under bot with progressive stake scaling.', category: 'Over/Under', xml: null },
  { id: 'over-hitnrun', name: 'Over HitnRun', description: 'Over digit hit-and-run strategy for fast in-and-out trades.', category: 'Over/Under', xml: null },
  { id: 'under-hitnrun', name: 'Under HitnRun', description: 'Under digit hit-and-run strategy for fast in-and-out trades.', category: 'Over/Under', xml: null },
  { id: 'over-hitnrun-enh', name: 'Over HitnRun 🎯', description: 'Enhanced over hit-and-run bot with automated recovery.', category: 'Over/Under', xml: null },
  { id: 'reborn-hnr', name: 'Reborn HnR (1)', description: 'Reborn even/odd hit-and-run strategy.', category: 'Even/Odd', xml: null },
  { id: 'over-destroyer', name: 'Over Destroyer 💀', description: 'Aggressive over digit destroyer with martingale recovery.', category: 'Over/Under', xml: null },
  { id: 'under-destroyer', name: 'Under Destroyer 💀', description: 'Aggressive under digit destroyer with martingale recovery.', category: 'Over/Under', xml: null },
  { id: 'over-destroyer-v2', name: 'Over Destroyer v2', description: 'Over destroyer v2 — refined over/under digit strategy.', category: 'Over/Under', xml: null },
  { id: 'under-destroyer-v2', name: 'Under Destroyer v2', description: 'Under destroyer v2 — refined over/under digit strategy.', category: 'Over/Under', xml: null },
  { id: 'over-pro-bot', name: 'Over Pro Bot 🐐', description: 'Pro-level over digit bot for volatility indices.', category: 'Over/Under', xml: null },
  { id: 'under-pro-bot', name: 'Under Pro Bot 🐐', description: 'Pro-level under digit bot for volatility indices.', category: 'Over/Under', xml: null },
  { id: 'under-8-pro', name: 'Under 8 pro bot 💕', description: 'Under 8 pro bot — precision under-digit entries.', category: 'Over/Under', xml: null },
  { id: 'even-odd-pro', name: 'Even/Odd Pro', description: 'Professional even/odd bot with streak detection.', category: 'Even/Odd', xml: null },
  { id: 'rise-fall-bot', name: 'Rise/Fall Smart Bot', description: 'Smart rise/fall bot with trend analysis.', category: 'Rise/Fall', xml: null },
  { id: 'martingale-classic', name: 'Martingale Classic', description: 'Classic martingale strategy for even/odd markets.', category: 'Even/Odd', xml: null },
  { id: 'dalembert', name: "D'Alembert Bot", description: "D'Alembert progressive staking system.", category: 'Even/Odd', xml: null },
];

const CATEGORIES = ['All', 'Over/Under', 'Even/Odd', 'Rise/Fall'];

// Generate a simple Blockly XML for the bot
const generateBotXml = (bot: typeof FREE_BOTS[0]): string => {
  return `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="trade" x="100" y="100">
    <comment pinned="false" h="80" w="160">${bot.description}</comment>
    <field name="MARKET_LIST">forex</field>
    <field name="SUBMARKET_LIST">smart_fx</field>
    <field name="SYMBOL_LIST">frxAUDJPY</field>
    <field name="TRADETYPECAT_LIST">callput</field>
    <field name="TRADETYPE_LIST">callput</field>
    <field name="TYPE_LIST">CALL</field>
    <field name="DURATIONTYPE_LIST">t</field>
    <field name="DURATION">1</field>
    <field name="CURRENCY_LIST">USD</field>
    <field name="AMOUNT_LIMITS">1</field>
    <field name="AMOUNT">1</field>
    <field name="CHECKBOX_TIMESELLPROFIT">FALSE</field>
    <field name="PROFITTAKE">0</field>
    <field name="CHECKBOX_TIMESELLSTOP">FALSE</field>
    <field name="STOPLOSSTAKE">0</field>
    <statement name="INITIALIZATION">
    </statement>
    <statement name="BEFORE_PURCHASE">
    </statement>
    <statement name="PURCHASE">
      <block type="purchase">
        <field name="PURCHASE_LIST">CALL</field>
      </block>
    </statement>
    <statement name="DURING_PURCHASE">
    </statement>
    <statement name="AFTER_PURCHASE">
    </statement>
  </block>
</xml>`;
};

const FreeBots = observer(() => {
  const store = useStore();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const filtered = FREE_BOTS.filter(b => {
    const matchCat = category === 'All' || b.category === category;
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleLoad = useCallback(async (bot: typeof FREE_BOTS[0]) => {
    setLoadingId(bot.id);

    try {
      const xml = generateBotXml(bot);

      // Load the bot XML into the Blockly workspace
      if (typeof Blockly !== 'undefined' && Blockly.derivWorkspace) {
        const dom = Blockly.Xml.textToDom(xml);
        Blockly.Events.setEnabled(false);
        Blockly.derivWorkspace.clear();
        Blockly.Xml.domToWorkspace(dom, Blockly.derivWorkspace);
        Blockly.Events.setEnabled(true);
        setLoadedId(bot.id);
      } else if (store?.load_modal) {
        // Navigate to bot builder tab
        store.dashboard?.setActiveTab(1);
      }

      // Switch to bot builder tab
      store?.dashboard?.setActiveTab?.(1);

      setTimeout(() => setLoadedId(null), 3000);
    } catch (e) {
      console.error('Load bot error', e);
    } finally {
      setLoadingId(null);
    }
  }, [store]);

  return (
    <div className='free-bots'>
      <div className='free-bots__header'>
        <div>
          <h1>🤖 Free Bots</h1>
          <p>Load any bot directly into the Bot Builder</p>
        </div>
        <div className='free-bots__search-box'>
          <input
            type='text'
            placeholder='Search bots...'
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className='free-bots__filters'>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`free-bots__filter-btn ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
        <span className='free-bots__count'>{filtered.length} bots</span>
      </div>

      <div className='free-bots__grid'>
        {filtered.map(bot => (
          <div key={bot.id} className='free-bots__card'>
            <div className='free-bots__card-body'>
              <span className='free-bots__category-tag'>{bot.category}</span>
              <h3 className='free-bots__bot-name'>{bot.name}</h3>
              <p className='free-bots__bot-desc'>{bot.description}</p>
            </div>
            <button
              className={`free-bots__load-btn ${loadedId === bot.id ? 'loaded' : ''}`}
              onClick={() => handleLoad(bot)}
              disabled={loadingId === bot.id}
            >
              {loadingId === bot.id ? '⏳ Loading...' : loadedId === bot.id ? '✅ Loaded!' : 'Load'}
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className='free-bots__empty'>
            <p>No bots found for "{search}" in {category}</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default FreeBots;
