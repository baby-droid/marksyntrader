// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import './free-bots.scss';

const FREE_BOTS = [
  {
    id: 'ahmed-syn-even-odd',
    name: 'Ahmed SYN Even/Odd Market Killer v1.2',
    description: '🔥 FEATURED — Ahmed\'s flagship bot. V25 1s market, Even/Odd, 1 tick, Martingale 2.2x, TP $2, SL $1000. Auto-recovers on loss.',
    category: 'Even/Odd',
    market: 'V25 1s (1HZ25V)',
    type: 'DIGITEVEN/DIGITODD',
    prediction: null,
    xmlFile: '/bots/ahmed-syn-even-odd.xml',
    badge: 'AHMED ★',
    badgeColor: '#00ff88',
    icon: '🤖',
    winRate: '~50%',
  },
  {
    id: 'ahmed-over-dt-oppo-killer',
    name: 'Ahmed OVER DT Oppo Killer',
    description: '🎯 Dual-prediction OVER strategy — V75 1s, switches prediction on loss (2→5). Martingale 2x, TP $5, SL $1000. Grace of God mode.',
    category: 'Over/Under',
    market: 'V75 1s (1HZ75V)',
    type: 'DIGITOVER',
    prediction: '2 / 5',
    xmlFile: '/bots/ahmed-over-dt-oppo-killer.xml',
    badge: 'NEW ★',
    badgeColor: '#ff6600',
    icon: '🔥',
    winRate: '73%',
  },
  {
    id: 'ahmed-under-dt-oppo-killer',
    name: 'Ahmed UNDER DT Oppo Killer',
    description: '⚔ Dual-prediction UNDER strategy — V75 1s, switches prediction on loss (7→5). Martingale 2x, TP $5, SL $1000. Grace of God mode.',
    category: 'Over/Under',
    market: 'V75 1s (1HZ75V)',
    type: 'DIGITUNDER',
    prediction: '7 / 5',
    xmlFile: '/bots/ahmed-under-dt-oppo-killer.xml',
    badge: 'NEW ★',
    badgeColor: '#4488ff',
    icon: '⚡',
    winRate: '72%',
  },
  {
    id: 'over1',
    name: 'AI Auto SYN Over 1',
    description: 'Best market killer — DIGIT OVER prediction 1 on V50 1s. Martingale x2, TP $3, SL $10.',
    category: 'Over/Under',
    market: 'V50 1s',
    type: 'DIGITOVER',
    prediction: 1,
    xmlFile: '/bots/over1.xml',
    badge: 'HOT',
    badgeColor: '#f44',
    icon: '⚡',
    winRate: '73%',
  },
  {
    id: 'over2',
    name: 'AI Auto SYN Over 2',
    description: 'Best market killer — DIGIT OVER prediction 2 on V50 1s. Martingale x2, TP $3, SL $10.',
    category: 'Over/Under',
    market: 'V50 1s',
    type: 'DIGITOVER',
    prediction: 2,
    xmlFile: '/bots/over2.xml',
    badge: 'HOT',
    badgeColor: '#f44',
    icon: '🎯',
    winRate: '71%',
  },
  {
    id: 'over3',
    name: 'AI Auto SYN Over 3',
    description: 'Best market killer — DIGIT OVER prediction 3 on V50 1s. Martingale x2, TP $3, SL $10.',
    category: 'Over/Under',
    market: 'V50 1s',
    type: 'DIGITOVER',
    prediction: 3,
    xmlFile: '/bots/over3.xml',
    badge: 'STRONG',
    badgeColor: '#2a9',
    icon: '💪',
    winRate: '69%',
  },
  {
    id: 'under8',
    name: 'AI Auto SYN Under 8',
    description: 'Best killer — DIGIT UNDER 8 on V100 1s. Martingale x3, TP $3, SL $10.',
    category: 'Over/Under',
    market: 'V100 1s',
    type: 'DIGITUNDER',
    prediction: 8,
    xmlFile: '/bots/under8.xml',
    badge: 'NEW',
    badgeColor: '#4e7cf5',
    icon: '🎰',
    winRate: '75%',
  },
  {
    id: 'under7',
    name: 'AI Auto SYN Under 7',
    description: 'Best killer — DIGIT UNDER 7 on V100 1s. Martingale x3, TP $3, SL $10.',
    category: 'Over/Under',
    market: 'V100 1s',
    type: 'DIGITUNDER',
    prediction: 7,
    xmlFile: '/bots/under7.xml',
    badge: 'NEW',
    badgeColor: '#4e7cf5',
    icon: '🔥',
    winRate: '72%',
  },
  {
    id: 'under6',
    name: 'AI Auto SYN Under 6',
    description: 'Best market killer — DIGIT UNDER 6 on V50 1s. Martingale x2, TP $3, SL $10.',
    category: 'Over/Under',
    market: 'V50 1s',
    type: 'DIGITUNDER',
    prediction: 6,
    xmlFile: '/bots/under6.xml',
    badge: 'SOLID',
    badgeColor: '#f5c842',
    icon: '⚔',
    winRate: '70%',
  },
  {
    id: 'evenodd',
    name: 'Ahmed SpeedBot Even/Odd v3',
    description: 'AI Even/Odd bot v3 — analyses streak of 100 ticks, trades Even or Odd based on dominance. TP $3 / SL $3.',
    category: 'Even/Odd',
    market: 'V10 1s',
    type: 'DIGITEVEN/DIGITODD',
    prediction: null,
    xmlFile: '/bots/evenodd.xml',
    badge: 'AI',
    badgeColor: '#a855f7',
    icon: '🤖',
    winRate: '68%',
  },
  {
    id: 'mrvunja',
    name: 'Mr Vunja Deriv V2026',
    description: 'Sniper digit strategy — Over on V75 1s. Dual prediction switching on loss. No stop loss.',
    category: 'Over/Under',
    market: 'V75 1s',
    type: 'DIGITOVER',
    prediction: '2 / 4',
    xmlFile: '/bots/mrvunja.xml',
    badge: '2026',
    badgeColor: '#ff6b00',
    icon: '💎',
    winRate: '77%',
  },
  {
    id: 'market-killer-prime-v1',
    name: 'Market Killer Prime V1',
    description: '👑 PRIME — V25 1s, DIGIT OVER 2. Martingale 2.2x. TP $3, SL $1000. Auto-recovers. The most aggressive recovery bot.',
    category: 'Over/Under',
    market: 'V25 1s (1HZ25V)',
    type: 'DIGITOVER',
    prediction: '2',
    xmlFile: '/bots/market-killer-prime-v1.xml',
    badge: 'PRIME ★',
    badgeColor: '#ff0066',
    icon: '👑',
    winRate: '~75%',
  },
];

const CATEGORIES = ['All', 'Over/Under', 'Even/Odd'];

const FreeBots = observer(() => {
  const store = useStore();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState(true);

  const filtered = FREE_BOTS.filter(b => {
    const matchCat = category === 'All' || b.category === category;
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const loadXmlIntoWorkspace = useCallback(async (bot: typeof FREE_BOTS[0], xml: string) => {
    const workspace = (window as any).Blockly?.derivWorkspace;
    if (!workspace) return false;
    const lm: any = store?.load_modal;
    if (lm?.loadStrategyToBuilder) {
      try {
        await lm.loadStrategyToBuilder(
          { id: bot.id, xml, name: bot.name, save_type: 'unsaved' },
          false
        );
        return true;
      } catch (err) {
        /* fall through */
      }
    }
    try {
      const B = (window as any).Blockly;
      const dom = B.Xml.textToDom(xml);
      B.derivWorkspace.asyncClear?.();
      B.Xml.domToWorkspace(dom, B.derivWorkspace);
      B.derivWorkspace.strategy_to_load = xml;
      B.svgResize?.(B.derivWorkspace);
      try { B.derivWorkspace.scrollCenter?.(); } catch (_) {}
      return true;
    } catch (err) {
      console.error('domToWorkspace error', err);
      return false;
    }
  }, [store]);

  /** Auto-press the main Run button once the bot's XML is loaded into the workspace. */
  const autoRun = useCallback(async () => {
    const run_panel: any = store?.run_panel;
    if (!run_panel?.onRunButtonClick) return;
    if (run_panel.is_running) return; // already running — don't double-fire
    try {
      await run_panel.onRunButtonClick();
    } catch (err) {
      console.error('Auto-run bot error', err);
    }
  }, [store]);

  const handleLoad = useCallback(async (bot: typeof FREE_BOTS[0]) => {
    setLoadingId(bot.id);
    try {
      const response = await fetch(bot.xmlFile);
      if (!response.ok) throw new Error(`Failed to fetch ${bot.xmlFile}`);
      const xml = await response.text();

      (window as any).__pendingBotXml = xml;
      (window as any).__pendingBotName = bot.name;

      store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
      store?.run_panel?.toggleDrawer?.(true);

      let loaded = await loadXmlIntoWorkspace(bot, xml);
      if (!loaded) {
        loaded = await new Promise<boolean>(resolve => {
          let attempts = 0;
          const poll = setInterval(async () => {
            attempts++;
            const ok = await loadXmlIntoWorkspace(bot, xml);
            if (ok || attempts >= 50) {
              clearInterval(poll);
              resolve(ok);
            }
          }, 100);
        });
      }

      setLoadedId(bot.id);
      setTimeout(() => setLoadedId(null), 4000);

      // Auto-enable & press the main Run button — the bot then trades
      // continuously (with its own martingale/TP/SL logic) until the user
      // hits Stop, exactly like manually clicking Run after loading a bot.
      if (loaded) {
        setTimeout(() => autoRun(), 400);
      }
    } catch (e) {
      console.error('Load bot error', e);
      store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
    } finally {
      setLoadingId(null);
    }
  }, [store, loadXmlIntoWorkspace, autoRun]);

  const handleViewCircles = useCallback(() => {
    store?.dashboard?.setActiveTab?.(DBOT_TABS.DCIRCLES);
  }, [store]);

  return (
    <div className='free-bots'>
      {disclaimer && (
        <div className='free-bots__disclaimer'>
          <span className='free-bots__disclaimer-icon'>⚠</span>
          <div className='free-bots__disclaimer-text'>
            <strong>RISK DISCLAIMER</strong> — Trading involves risk. Past performance does not guarantee future results. Trade responsibly. AHMED SYN TRADER bots are tools, not financial advice.
          </div>
          <button className='free-bots__disclaimer-close' onClick={() => setDisclaimer(false)}>✕</button>
        </div>
      )}

      <div className='free-bots__header'>
        <div className='free-bots__header-left'>
          <h1>🤖 <span>AHMED SYN TRADER</span> — Free Bots</h1>
          <p>{FREE_BOTS.length} professional bots • Load any bot directly into Bot Builder</p>
        </div>
        <div className='free-bots__header-actions'>
          <button className='free-bots__circles-btn' onClick={handleViewCircles}>
            ⭕ View DCircles
          </button>
          <div className='free-bots__search-box'>
            <span>🔍</span>
            <input type='text' placeholder='Search bots...' value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className='free-bots__filters'>
        {CATEGORIES.map(cat => (
          <button key={cat} className={`free-bots__filter-btn ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>
            {cat}
          </button>
        ))}
        <span className='free-bots__count'>{filtered.length} bots</span>
      </div>

      <div className='free-bots__grid'>
        {filtered.map(bot => (
          <div
            key={bot.id}
            className={`free-bots__card ${loadedId === bot.id ? 'free-bots__card--loaded' : ''}`}
            style={{ '--accent': bot.badgeColor } as React.CSSProperties}
          >
            <div className='free-bots__card-glow' />
            <div className='free-bots__card-icon-ring'>
              <div className='free-bots__card-icon'>{bot.icon}</div>
            </div>
            <div className='free-bots__badge' style={{ background: bot.badgeColor }}>{bot.badge}</div>
            <div className='free-bots__card-body'>
              <span className='free-bots__category-tag'>{bot.category}</span>
              <h3 className='free-bots__bot-name'>{bot.name}</h3>
              <p className='free-bots__bot-desc'>{bot.description}</p>
            </div>
            <div className='free-bots__card-meta'>
              <div className='free-bots__meta-item'>
                <span className='free-bots__meta-label'>MARKET</span>
                <span className='free-bots__meta-val'>{bot.market}</span>
              </div>
              <div className='free-bots__meta-item'>
                <span className='free-bots__meta-label'>TYPE</span>
                <span className='free-bots__meta-val' style={{ fontSize: '1rem' }}>{bot.type}</span>
              </div>
              {bot.prediction !== null && (
                <div className='free-bots__meta-item'>
                  <span className='free-bots__meta-label'>PRED</span>
                  <span className='free-bots__meta-val'>{bot.prediction}</span>
                </div>
              )}
              <div className='free-bots__meta-item'>
                <span className='free-bots__meta-label'>WIN RATE</span>
                <span className='free-bots__meta-val free-bots__meta-val--green'>{bot.winRate}</span>
              </div>
            </div>
            <button
              className={`free-bots__load-btn ${loadedId === bot.id ? 'loaded' : ''}`}
              onClick={() => handleLoad(bot)}
              disabled={loadingId === bot.id}
            >
              {loadingId === bot.id ? (
                <span className='free-bots__load-spinner'>⏳ Loading...</span>
              ) : loadedId === bot.id ? (
                <span>🚀 Loaded — Running...</span>
              ) : (
                <>▶ Load &amp; Run Bot</>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

export default FreeBots;
