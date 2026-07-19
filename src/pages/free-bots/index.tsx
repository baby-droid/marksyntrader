// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import './free-bots.scss';

const FREE_BOTS = [
  // ── From latest uploads (July 2026) ──────────────────────────────────────
  {
    id: 'ahmed-under-dt-oppo-killer',
    name: 'Ahmed UNDER DT Oppo Killer',
    description: '🔄 Dual-prediction UNDER — switches digit on loss (oppo mode). Martingale 2x, smart recovery. Verified killer.',
    category: 'Over/Under', market: 'V75 1s', type: 'DIGITUNDER', prediction: 'DT',
    xmlFile: '/bots/ahmed-under-dt-oppo-killer.xml',
    badge: 'OPPO ★', badgeColor: '#7ec8e3', icon: '🔄', winRate: '~73%',
  },
  {
    id: 'ai-under-5-best-killer',
    name: 'AI Auto Under 5 — Best Killer',
    description: '⚔️ AI-powered DIGIT UNDER 5 — best entry confirmation, Martingale 2x, TP/SL built-in. Top-tier performance.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITUNDER', prediction: '5',
    xmlFile: '/bots/ai-under-5-best-killer.xml',
    badge: 'BEST ⚔️', badgeColor: '#5ab9ea', icon: '⚔️', winRate: '~74%',
  },
  {
    id: 'ai-over-3-version-killer',
    name: 'AI Auto Over 3 — Version Killer',
    description: '🚀 DIGIT OVER 3 version killer — enhanced AI entry logic, Martingale 2x, rapid recovery protocol.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITOVER', prediction: '3',
    xmlFile: '/bots/ai-over-3-version-killer.xml',
    badge: 'KILLER 🚀', badgeColor: '#89c4f4', icon: '🚀', winRate: '~72%',
  },
  {
    id: 'ai-over-2-version-killer',
    name: 'AI Auto Over 2 — Version Killer',
    description: '💥 DIGIT OVER 2 version killer — aggressive entry, AI pattern detection, Martingale 2x recovery.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITOVER', prediction: '2',
    xmlFile: '/bots/ai-over-2-version-killer.xml',
    badge: 'KILLER 💥', badgeColor: '#6cb4e4', icon: '💥', winRate: '~71%',
  },
  {
    id: 'ai-over-4-confidence-booster',
    name: 'AI Auto Over 4 — Confidence Booster',
    description: '🎯 DIGIT OVER 4 confidence booster — precision AI entry, dual-confirm system, Martingale 2x with TP/SL.',
    category: 'Over/Under', market: 'V75 1s', type: 'DIGITOVER', prediction: '4',
    xmlFile: '/bots/ai-over-4-confidence-booster.xml',
    badge: 'BOOST 🎯', badgeColor: '#add8e6', icon: '🎯', winRate: '~73%',
  },
  {
    id: 'syn-under6-best-killer',
    name: 'AI Auto SYN Under 6 — Best Killer',
    description: '💎 DIGIT UNDER 6 best killer — AI-confirmed entry on V50 1s, Martingale x2, precision TP/SL.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITUNDER', prediction: '6',
    xmlFile: '/bots/syn-under6-best-killer.xml',
    badge: 'BEST 💎', badgeColor: '#5ab9ea', icon: '💎', winRate: '~72%',
  },
  {
    id: 'syn-under6-market-killer',
    name: 'AI Auto SYN Under 6 — Best Market Killer',
    description: '🔥 Best market killer — DIGIT UNDER 6, AI analysis, Martingale x2. Universal entry detection.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITUNDER', prediction: '6',
    xmlFile: '/bots/syn-under6-market-killer.xml',
    badge: 'MKT 🔥', badgeColor: '#7ec8e3', icon: '🔥', winRate: '~73%',
  },
  {
    id: 'syn-under3-best-killer',
    name: 'AI Auto SYN Under 3 — Best Market Killer',
    description: '⚡ DIGIT UNDER 3 best market killer — high-frequency AI entry, Martingale 2x, aggressive recovery.',
    category: 'Over/Under', market: 'V100 1s', type: 'DIGITUNDER', prediction: '3',
    xmlFile: '/bots/syn-under3-best-killer.xml',
    badge: 'BEST ⚡', badgeColor: '#add8e6', icon: '⚡', winRate: '~71%',
  },
  {
    id: 'syn-over1-market-killer',
    name: 'AI Auto SYN Over 1 — Best Market Killer',
    description: '🏅 DIGIT OVER 1 best market killer — ultra-high win rate, AI entry confirmation, 2x martingale.',
    category: 'Over/Under', market: 'V100 1s', type: 'DIGITOVER', prediction: '1',
    xmlFile: '/bots/syn-over1-market-killer.xml',
    badge: 'BEST 🏅', badgeColor: '#89c4f4', icon: '🏅', winRate: '~88%',
  },
  // ── Existing bots ─────────────────────────────────────────────────────────
  {
    id: 'ahmed-killer-any-market',
    name: 'Ahmed Killer Any Market',
    description: '🏆 Universal market killer — works on any Volatility index. Smart entry with Over/Under strategy. Martingale 2x.',
    category: 'Over/Under', market: 'Any Market', type: 'DIGITOVER/DIGITUNDER', prediction: 'AI',
    xmlFile: '/bots/ahmed-killer-any-market.xml',
    badge: '🏆 KILLER', badgeColor: '#89c4f4', icon: '🏆', winRate: '~74%',
  },
  {
    id: 'ahmed-over4-hunter',
    name: 'Ahmed AI Over 4 Deriv Hunter',
    description: '🎯 AI-powered Over 4 strategy — hunts the best entry on Deriv volatility markets. Martingale 2x, precision entry.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITOVER', prediction: '4',
    xmlFile: '/bots/ahmed-over4-hunter.xml',
    badge: 'HUNTER', badgeColor: '#7ec8e3', icon: '🎯', winRate: '~72%',
  },
  {
    id: 'syn-over7',
    name: 'AI Auto SYN Over 7 — Best Market Killer',
    description: '⚡ Best market killer — DIGIT OVER 7 on V100 1s. Advanced AI entry analysis. Martingale x2.',
    category: 'Over/Under', market: 'V100 1s', type: 'DIGITOVER', prediction: '7',
    xmlFile: '/bots/syn-over7.xml',
    badge: 'BEST ⚡', badgeColor: '#add8e6', icon: '⚡', winRate: '~75%',
  },
  {
    id: 'syn-under7',
    name: 'AI Auto SYN Under 7 — Best Killer',
    description: '💎 Best killer — DIGIT UNDER 7 on V100 1s. Full AI pattern analysis. Martingale x2.',
    category: 'Over/Under', market: 'V100 1s', type: 'DIGITUNDER', prediction: '7',
    xmlFile: '/bots/syn-under7.xml',
    badge: 'BEST 💎', badgeColor: '#5ab9ea', icon: '💎', winRate: '~73%',
  },
  {
    id: 'ahmed-over3-hunter',
    name: 'Ahmed AI Over 3 Deriv Hunter',
    description: '🔥 Deriv Hunter v3 — Over 3 strategy on V50 1s. AI-driven entry confirmation, 2x martingale, TP/SL built in.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITOVER', prediction: '3',
    xmlFile: '/bots/ahmed-over3-hunter.xml',
    badge: 'HUNTER 🔥', badgeColor: '#6cb4e4', icon: '🔥', winRate: '~70%',
  },
  {
    id: 'ahmed-over2-killer',
    name: 'Ahmed AI Over 2 Version Killer',
    description: '💪 AI Over 2 Killer — aggressive DIGIT OVER 2 on V50 1s. 2x martingale with smart recovery.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITOVER', prediction: '2',
    xmlFile: '/bots/ahmed-over2-killer.xml',
    badge: 'KILLER', badgeColor: '#89c4f4', icon: '💪', winRate: '~71%',
  },
  {
    id: 'london-over1-killer',
    name: 'London Over 1 Killer',
    description: '🇬🇧 London session bot — DIGIT OVER 1 on V75 1s. Martingale 2x, TP $5, SL $10.',
    category: 'Over/Under', market: 'V75 1s', type: 'DIGITOVER', prediction: '1',
    xmlFile: '/bots/london-over1-killer.xml',
    badge: 'LONDON', badgeColor: '#7ec8e3', icon: '🇬🇧', winRate: '~76%',
  },
  {
    id: 'london-over2-killer',
    name: 'London Over 2 Killer',
    description: '🌍 London Over 2 — premium DIGIT OVER 2 strategy on V75 1s. Martingale 2x, high win-rate.',
    category: 'Over/Under', market: 'V75 1s', type: 'DIGITOVER', prediction: '2',
    xmlFile: '/bots/london-over2-killer.xml',
    badge: 'LONDON', badgeColor: '#add8e6', icon: '🌍', winRate: '~74%',
  },
  {
    id: 'syn-under6',
    name: 'AI Auto SYN Under 6 — Best Market Killer',
    description: '🎖 Best market killer — DIGIT UNDER 6 on V50 1s. AI analysis confirms entry. Martingale x2.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITUNDER', prediction: '6',
    xmlFile: '/bots/syn-under6.xml',
    badge: 'BEST 🎖', badgeColor: '#5ab9ea', icon: '🎖', winRate: '~71%',
  },
  {
    id: 'ahmed-over-dt-oppo-killer',
    name: 'Ahmed OVER DT Oppo Killer',
    description: '🎯 Dual-prediction OVER — V75 1s, switches prediction on loss (2→5). Martingale 2x, TP $5.',
    category: 'Over/Under', market: 'V75 1s', type: 'DIGITOVER', prediction: '2 / 5',
    xmlFile: '/bots/ahmed-over-dt-oppo-killer.xml',
    badge: 'OPPO ★', badgeColor: '#7ec8e3', icon: '🔥', winRate: '73%',
  },
  {
    id: 'ahmed-syn-even-odd',
    name: 'Ahmed SYN Even/Odd Market Killer v1.2',
    description: '🔥 FEATURED — Ahmed\'s flagship bot. V25 1s, Even/Odd, 1 tick, Martingale 2.2x, TP $2.',
    category: 'Even/Odd', market: 'V25 1s', type: 'DIGITEVEN/DIGITODD', prediction: null,
    xmlFile: '/bots/ahmed-syn-even-odd.xml',
    badge: 'AHMED ★', badgeColor: '#89c4f4', icon: '🤖', winRate: '~50%',
  },
  {
    id: 'speed-bot-v2-2',
    name: '⚡ Speed Bot With Entry v2.2',
    description: '🚀 Ultra-fast DIGIT UNDER on V100 1s — advanced entry logic, Martingale 1.3x. TP $15, SL $10.',
    category: 'Over/Under', market: 'V100 1s', type: 'DIGITUNDER', prediction: '5',
    xmlFile: '/bots/speed-bot-v2.2.xml',
    badge: 'SPEED ⚡', badgeColor: '#add8e6', icon: '⚡', winRate: '~71%',
  },
  {
    id: 'market-killer-prime-v1',
    name: 'Market Killer Prime V1',
    description: '👑 PRIME — V25 1s, DIGIT OVER 2. Martingale 2.2x. TP $3, SL $1000. Most aggressive recovery.',
    category: 'Over/Under', market: 'V25 1s', type: 'DIGITOVER', prediction: '2',
    xmlFile: '/bots/market-killer-prime-v1.xml',
    badge: 'PRIME ★', badgeColor: '#89c4f4', icon: '👑', winRate: '~75%',
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
    const matchCat    = category === 'All' || b.category === category;
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const loadXmlIntoWorkspace = useCallback(async (bot: typeof FREE_BOTS[0], xml: string) => {
    const workspace = (window as any).Blockly?.derivWorkspace;
    if (!workspace) return false;
    const lm: any = store?.load_modal;
    if (lm?.loadStrategyToBuilder) {
      try {
        await lm.loadStrategyToBuilder({ id: bot.id, xml, name: bot.name, save_type: 'unsaved' }, false);
        return true;
      } catch {}
    }
    try {
      const B   = (window as any).Blockly;
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

  const autoRun = useCallback(async () => {
    const run_panel: any = store?.run_panel;
    if (!run_panel?.onRunButtonClick || run_panel.is_running) return;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        if (run_panel.is_running) return;
        await run_panel.onRunButtonClick();
        return;
      } catch {
        if (attempt < 5) await new Promise(r => setTimeout(r, 500));
      }
    }
  }, [store]);

  const handleLoadOnly = useCallback(async (bot: typeof FREE_BOTS[0]) => {
    setLoadingId(bot.id);
    try {
      const res = await fetch(bot.xmlFile);
      if (!res.ok) throw new Error(`Failed to fetch ${bot.xmlFile}`);
      const xml = await res.text();
      (window as any).__pendingBotXml  = xml;
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
            if (ok || attempts >= 50) { clearInterval(poll); resolve(ok); }
          }, 100);
        });
      }
      setLoadedId(bot.id);
      setTimeout(() => setLoadedId(null), 3000);
    } catch (e) {
      console.error('Load bot error', e);
      store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
    } finally {
      setLoadingId(null);
    }
  }, [store, loadXmlIntoWorkspace]);

  const handleLoadAndRun = useCallback(async (bot: typeof FREE_BOTS[0]) => {
    setLoadingId(bot.id);
    try {
      const res = await fetch(bot.xmlFile);
      if (!res.ok) throw new Error(`Failed to fetch ${bot.xmlFile}`);
      const xml = await res.text();
      (window as any).__pendingBotXml  = xml;
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
            if (ok || attempts >= 50) { clearInterval(poll); resolve(ok); }
          }, 100);
        });
      }
      setLoadedId(bot.id);
      setTimeout(() => setLoadedId(null), 4000);
      if (loaded) setTimeout(() => autoRun(), 900);
    } catch (e) {
      console.error('Load & Run error', e);
      store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
    } finally {
      setLoadingId(null);
    }
  }, [store, loadXmlIntoWorkspace, autoRun]);

  return (
    <div className='free-bots'>
      {disclaimer && (
        <div className='free-bots__disclaimer'>
          <span className='free-bots__disclaimer-icon'>⚠</span>
          <div className='free-bots__disclaimer-text'>
            <strong>RISK DISCLAIMER</strong> — Trading involves risk. Past performance does not guarantee future results. Trade responsibly.
          </div>
          <button className='free-bots__disclaimer-close' onClick={() => setDisclaimer(false)}>✕</button>
        </div>
      )}

      <div className='free-bots__header'>
        <div className='free-bots__header-left'>
          <h1>🤖 <span>AHMED SYN TRADER</span> — Free Bots</h1>
          <p>{FREE_BOTS.length} professional bots • Click "Load Bot" to open in Bot Builder</p>
        </div>
      </div>

      <div className='free-bots__filters'>
        <div className='free-bots__search-box'>
          <span>🔍</span>
          <input type='text' placeholder='Search bots...' value={search} onChange={e => setSearch(e.target.value)} />
        </div>
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
            <div className='free-bots__card-top'>
              <div className='free-bots__card-icon-ring'>
                <div className='free-bots__card-icon'>{bot.icon}</div>
              </div>
              <div className='free-bots__badge' style={{ background: bot.badgeColor }}>{bot.badge}</div>
            </div>
            <div className='free-bots__card-body'>
              <span className='free-bots__category-tag'>{bot.category}</span>
              <h3 className='free-bots__bot-name'>{bot.name}</h3>
              <p className='free-bots__bot-desc'>{bot.description}</p>
            </div>
            <div className='free-bots__card-meta'>
              <div className='free-bots__meta-item'>
                <span className='free-bots__meta-label'>MKT</span>
                <span className='free-bots__meta-val'>{bot.market}</span>
              </div>
              <div className='free-bots__meta-item'>
                <span className='free-bots__meta-label'>TYPE</span>
                <span className='free-bots__meta-val' style={{ fontSize: '0.75rem' }}>{bot.type}</span>
              </div>
              {bot.prediction !== null && (
                <div className='free-bots__meta-item'>
                  <span className='free-bots__meta-label'>PRED</span>
                  <span className='free-bots__meta-val'>{bot.prediction}</span>
                </div>
              )}
              <div className='free-bots__meta-item'>
                <span className='free-bots__meta-label'>WIN%</span>
                <span className='free-bots__meta-val free-bots__meta-val--green'>{bot.winRate}</span>
              </div>
            </div>
            {/* Two buttons: Load Bot (green) + Load & Run (accent) */}
            <div className='free-bots__btn-row'>
              <button
                className='free-bots__load-btn free-bots__load-btn--green'
                onClick={() => handleLoadOnly(bot)}
                disabled={loadingId === bot.id}
                title='Load into Bot Builder (without running)'
              >
                {loadingId === bot.id ? '⏳' : '📂 Load Bot'}
              </button>
              <button
                className={`free-bots__load-btn free-bots__load-btn--run ${loadedId === bot.id ? 'loaded' : ''}`}
                onClick={() => handleLoadAndRun(bot)}
                disabled={loadingId === bot.id}
                title='Load & Auto-Run'
              >
                {loadingId === bot.id ? (
                  <span>⏳</span>
                ) : loadedId === bot.id ? (
                  <span>🚀 Running!</span>
                ) : (
                  <>▶ Load &amp; Run</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default FreeBots;
