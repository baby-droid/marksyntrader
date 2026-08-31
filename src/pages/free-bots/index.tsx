// @ts-nocheck
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { api_base, load, save_types } from '@/external/bot-skeleton';
import { isFastExecutionEnabled } from '@/utils/execution-speed';
import { setTradeContext } from '@/utils/trade-metadata';
import './free-bots.scss';

const DIFFERS_CYCLE_SHARED_BLOCKS = [
  { id: 'gt.seq.applySequence', file: '/attached_assets/block_(1)_1788162146803.xml' },
  { id: 'gt.seq.beforePurchase', file: '/attached_assets/block_(2)_1788162153348.xml' },
  { id: 'gt.seq.tradeDef', file: '/attached_assets/block_(3)_1788162160415.xml' },
  { id: 'gt.seq.afterPurchase', file: '/attached_assets/block_(4)_1788162166311.xml' },
];

const FREE_BOTS = [
  {
    id: 'differs-edge-scanner',
    name: 'Differs Edge Scanner — Recovery Matrix',
    description: '🧠 Scans the latest digit, rotates Differs → Over 1 → Over 2 → Differs → Under 8 → Under 7, then uses Even/Odd recovery after a loss. Includes 2× stake recovery.',
    category: 'Scanner', market: 'V50 1s', type: 'Multi-Strategy', prediction: 'SCAN',
    xmlFile: '/bots/differs-edge-scanner.xml',
    badge: 'SCAN 🧠', badgeColor: '#34d399', icon: '🔎', winRate: '—',
    sharedBlockAssets: DIFFERS_CYCLE_SHARED_BLOCKS,
  },
  {
    id: 'ahmed-differs-cycle',
    name: 'AHMED DIFFERS CYCLE',
    description: '🔁 Shared-block cycle: DIFFERS → OVER 1 → OVER 2 → DIFFERS → UNDER 8 → UNDER 7, then Even/Odd parity recovery after a loss. Includes 2× stake recovery.',
    category: 'Scanner', market: 'V50 1s', type: 'Multi-Strategy', prediction: 'CYCLE',
    xmlFile: '/bots/ahmed-differs-cycle.xml',
    badge: 'AHMED CYCLE', badgeColor: '#f59e0b', icon: '🔁', winRate: '—',
    sharedBlockAssets: DIFFERS_CYCLE_SHARED_BLOCKS,
  },
  {
    id: 'ahmed-auto-even',
    name: 'AHMED AUTO EVEN — Streak Reversal',
    description: '🎯 Detects an odd-digit streak or low odd digits, then buys DIGIT EVEN. Includes real purchase/trade-again flow, notifications, 2× martingale, TP and SL.',
    category: 'Even/Odd', market: 'V25 1s', type: 'DIGITEVEN', prediction: 'EVEN',
    xmlFile: '/bots/ahmed-auto-even.xml',
    badge: 'AUTO EVEN', badgeColor: '#34d399', icon: '✅', winRate: '—',
  },
  {
    id: 'ahmed-auto-odd',
    name: 'AHMED AUTO ODD — Streak Reversal',
    description: '🎯 Detects an even-digit streak or low even digits, then buys DIGIT ODD. Includes real purchase/trade-again flow, notifications, 2× martingale, TP and SL.',
    category: 'Even/Odd', market: 'V25 1s', type: 'DIGITODD', prediction: 'ODD',
    xmlFile: '/bots/ahmed-auto-odd.xml',
    badge: 'AUTO ODD', badgeColor: '#60a5fa', icon: '🔢', winRate: '—',
  },
  // ── Recovery barrier bots ────────────────────────────────────────────────
  {
    id: 'recovery-over1-over3',
    name: 'Over 1 → Recovery Over 3',
    description: '🎯 Waits for a confirmed digit pattern, trades OVER 1, then switches to OVER 3 after a loss. Configured stake, martingale, TP/SL and restart blocks.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITOVER', prediction: '1 → 3',
    xmlFile: '/bots/over1.xml',
    badge: 'RECOVERY', badgeColor: '#34d399', icon: '↗', winRate: '—',
  },
  {
    id: 'recovery-over2-over3',
    name: 'Over 2 → Recovery Over 3',
    description: '🎯 Pattern-confirmed OVER 2 entry with automatic OVER 3 recovery barrier after a loss, plus martingale and session limits.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITOVER', prediction: '2 → 3',
    xmlFile: '/bots/over2.xml',
    badge: 'RECOVERY', badgeColor: '#34d399', icon: '↗', winRate: '—',
  },
  {
    id: 'recovery-over3-over4',
    name: 'Over 3 → Recovery Over 4',
    description: '🎯 Pattern-confirmed OVER 3 entry with automatic OVER 4 recovery barrier after a loss, stake progression and restart controls.',
    category: 'Over/Under', market: 'V50 1s', type: 'DIGITOVER', prediction: '3 → 4',
    xmlFile: '/bots/over3.xml',
    badge: 'RECOVERY', badgeColor: '#34d399', icon: '↗', winRate: '—',
  },
  {
    id: 'recovery-under8-under6',
    name: 'Under 8 → Recovery Under 6',
    description: '🎯 Pattern-confirmed UNDER 8 entry with automatic UNDER 6 recovery barrier after a loss, martingale and session limits.',
    category: 'Over/Under', market: 'V100 1s', type: 'DIGITUNDER', prediction: '8 → 6',
    xmlFile: '/bots/under8.xml',
    badge: 'RECOVERY', badgeColor: '#60a5fa', icon: '↘', winRate: '—',
  },
  {
    id: 'recovery-under7-under6',
    name: 'Under 7 → Recovery Under 6',
    description: '🎯 Pattern-confirmed UNDER 7 entry with automatic UNDER 6 recovery barrier after a loss, martingale and restart controls.',
    category: 'Over/Under', market: 'V100 1s', type: 'DIGITUNDER', prediction: '7 → 6',
    xmlFile: '/bots/under7.xml',
    badge: 'RECOVERY', badgeColor: '#60a5fa', icon: '↘', winRate: '—',
  },
  {
    id: 'recovery-under6-under5',
    name: 'Under 6 → Recovery Under 5',
    description: '🎯 Pattern-confirmed UNDER 6 entry with automatic UNDER 5 recovery barrier after a loss, stake progression and session limits.',
    category: 'Over/Under', market: 'V100 1s', type: 'DIGITUNDER', prediction: '6 → 5',
    xmlFile: '/bots/under6.xml',
    badge: 'RECOVERY', badgeColor: '#60a5fa', icon: '↘', winRate: '—',
  },
  // ── NEW signature bots — Omni Cycle Trader Pro & Smart Entry Pattern Pro V2 ─
  {
    id: 'omni-cycle-trader-pro',
    name: 'Omni Cycle Trader Pro — 7-Phase Full Cycle',
    description: '🔄 7-PHASE MASTER CYCLE — Even → Over → Under → Differs → Rise → Fall → Odd. Auto-recovery after 3 losses. Martingale 2×. TP $10 / SL $50. V75 1s.',
    category: 'Cycle', market: 'V75 1s', type: 'Multi-Strategy', prediction: 'AUTO',
    xmlFile: '/bots/omni-cycle-trader-pro.xml',
    badge: 'OMNI 🔄', badgeColor: '#a78bfa', icon: '🔄', winRate: '~67%',
  },
  {
    id: 'smart-entry-pattern-pro-v2',
    name: 'Smart Entry Pattern Pro V2 — Advanced Scanner',
    description: '🧠 FULL PATTERN BOT — 3 odds+1 even→EVEN, 3 evens+1 odd→ODD, Low-even→ODD, Low-odd→EVEN, High-9+streak→EVEN, High-8+streak→ODD. Scan mode. Martingale 2×. TP $5 / SL $50.',
    category: 'Even/Odd', market: 'V25 1s', type: 'DIGITEVEN/DIGITODD', prediction: 'PATTERN',
    xmlFile: '/bots/smart-entry-pattern-pro-v2.xml',
    badge: 'SMART 🧠', badgeColor: '#34d399', icon: '🧠', winRate: '~60%',
  },
  // ── New signature bots (August 2026) ─────────────────────────────────────
  {
    id: 'ahmed-cycle-master',
    name: 'Ahmed Cycle Master — 8-Phase Multi-Strategy',
    description: '🔄 SIGNATURE BOT — Trades 8 strategies in rotation: Even→Over1→Under8→Over3→Under6→Differs→Rise→Odd. Auto-recovery on 3+ losses. Martingale 2x. TP $5 / SL $20.',
    category: 'Cycle', market: 'V50 1s', type: 'Multi-Strategy', prediction: 'AUTO',
    xmlFile: '/bots/ahmed-cycle-master.xml',
    badge: 'CYCLE 🔄', badgeColor: '#a78bfa', icon: '🔄', winRate: '~65%',
  },
  {
    id: 'ahmed-pattern-scanner',
    name: 'Ahmed Pattern Scanner — Smart Even/Odd Entry',
    description: '🧠 AI PATTERN BOT — Reads last digit patterns: 3 consecutive Odds → buys Even, 3 Evens → buys Odd. Smart contrarian logic. Martingale 2x. Auto-invert on 5 losses. TP $5 / SL $20.',
    category: 'Even/Odd', market: 'V25 1s', type: 'DIGITEVEN/DIGITODD', prediction: 'PATTERN',
    xmlFile: '/bots/ahmed-pattern-scanner.xml',
    badge: 'SCAN 🧠', badgeColor: '#34d399', icon: '🧠', winRate: '~55%',
  },
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
  // ── Newly uploaded bots ───────────────────────────────────────────────────
  {
    id: 'even-multiple-scalper-upload',
    name: 'Even Multiple Scalper',
    description: 'Uploaded EVEN multiple scalper strategy. Loads into Bot Builder using the original XML asset.',
    category: 'Even/Odd', market: 'Deriv Volatility', type: 'DIGITEVEN', prediction: 'EVEN',
    xmlFile: '/bots/even-multiple-scalper-upload.xml',
    badge: 'UPLOADED', badgeColor: '#34d399', icon: '2️⃣', winRate: '—',
  },
  {
    id: 'ahmed-speed-bot-even-odd-v3-upload',
    name: 'Ahmed Speed Bot Even/Odd v3',
    description: 'Uploaded Ahmed Speed Bot Even/Odd v3 strategy.',
    category: 'Even/Odd', market: 'Deriv Volatility', type: 'DIGITEVEN/DIGITODD', prediction: 'EVEN/ODD',
    // The uploaded file is empty; use the existing valid copy so the card remains runnable.
    xmlFile: '/bots/ahmed-syn-even-odd.xml',
    badge: 'UPLOADED', badgeColor: '#60a5fa', icon: '⚡', winRate: '—',
  },
  {
    id: 'mr-vunja-deriv-v2026-upload',
    name: 'MR VUNJA DERIV V2026',
    description: 'Uploaded MR VUNJA DERIV V2026 strategy.',
    category: 'Over/Under', market: 'Deriv Volatility', type: 'Multi-Strategy', prediction: 'AUTO',
    xmlFile: '/bots/mr-vunja-deriv-v2026.xml',
    badge: 'UPLOADED', badgeColor: '#a78bfa', icon: '🧩', winRate: '—',
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

const CATEGORIES = ['All', 'Scanner', 'Cycle', 'Even/Odd', 'Over/Under'];

// Market Killer Prime V1 — market rotation for Trade Restart
const MKP_MARKETS = [
  { label: 'V25 1s',  symbol: '1HZ25V'  },
  { label: 'V50 1s',  symbol: '1HZ50V'  },
  { label: 'V75 1s',  symbol: '1HZ75V'  },
  { label: 'V100 1s', symbol: '1HZ100V' },
];

const FreeBots = observer(() => {
  const store = useStore();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState(true);

  // ── Market Killer Prime V1 panel state ──────────────────────────────────────
  const [mkpOpen, setMkpOpen]                   = useState(false);
  const [mkpStake, setMkpStake]                 = useState(1.00);
  const [mkpTicks, setMkpTicks]                 = useState(1);
  const [mkpMarketIdx, setMkpMarketIdx]         = useState(0); // index into MKP_MARKETS
  const [mkpLoading, setMkpLoading]             = useState(false);
  const [mkpResult, setMkpResult]               = useState<{ ok: boolean; msg: string } | null>(null);
  const [mkpContractOpen, setMkpContractOpen]   = useState(false); // true while contract is live
  const [mkpLastOutcome, setMkpLastOutcome]      = useState<'won' | 'lost' | null>(null);
  const [mkpAutoRestart, setMkpAutoRestart]     = useState(false);
  const [mkpDelay, setMkpDelay]                 = useState(3);
  const [mkpSwitchMarket, setMkpSwitchMarket]   = useState(false);

  // Synchronous in-flight guard (prevents double-orders on rapid taps)
  const mkpInFlightRef    = useRef(false);
  const mkpRestartRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mkpAutoRestartRef = useRef(false);
  const mkpDelayRef       = useRef(3);
  const mkpSwitchRef      = useRef(false);
  const mkpMarketIdxRef   = useRef(0);
  const mkpStakeRef       = useRef(1.00);
  const mkpTicksRef       = useRef(1);

  // Keep refs in sync
  useEffect(() => { mkpAutoRestartRef.current = mkpAutoRestart; }, [mkpAutoRestart]);
  useEffect(() => { mkpDelayRef.current       = mkpDelay;        }, [mkpDelay]);
  useEffect(() => { mkpSwitchRef.current      = mkpSwitchMarket; }, [mkpSwitchMarket]);
  useEffect(() => { mkpMarketIdxRef.current   = mkpMarketIdx;    }, [mkpMarketIdx]);
  useEffect(() => { mkpStakeRef.current       = mkpStake;        }, [mkpStake]);
  useEffect(() => { mkpTicksRef.current       = mkpTicks;        }, [mkpTicks]);

  // Clear restart timer when panel closes
  useEffect(() => {
    if (!mkpOpen && mkpRestartRef.current) {
      clearTimeout(mkpRestartRef.current);
      mkpRestartRef.current = null;
    }
  }, [mkpOpen]);

  const filtered = FREE_BOTS.filter(b => {
    const matchCat    = category === 'All' || b.category === category;
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Bot Builder load helpers ─────────────────────────────────────────────────
  const loadXmlIntoWorkspace = useCallback(async (bot: typeof FREE_BOTS[0], xml: string) => {
    let workspace = (window as any).Blockly?.derivWorkspace;
    if (!workspace) {
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const poll = setInterval(() => {
          attempts += 1;
          workspace = (window as any).Blockly?.derivWorkspace;
          if (workspace) {
            clearInterval(poll);
            resolve();
          } else if (attempts >= 100) {
            clearInterval(poll);
            reject(new Error('Bot Builder workspace unavailable after 10 seconds'));
          }
        }, 100);
      });
    }
    if (!workspace) return false;
    const lm: any = store?.load_modal;
    if (lm?.loadStrategyToBuilder) {
      try {
        await lm.loadStrategyToBuilder({ id: bot.id, xml, name: bot.name, save_type: 'unsaved' }, false);
        return true;
      } catch {}
    }
    // Keep the same official loader as the Bot Builder Free Bots panel when the
    // load-modal store is not available on this page.
    try {
      await load({
        block_string: xml,
        drop_event: null,
        file_name: bot.name,
        strategy_id: bot.id,
        from: save_types.LOCAL,
        workspace,
        showIncompatibleStrategyDialog: false,
        show_snackbar: false,
      });
      workspace.strategy_to_load = xml;
      return true;
    } catch (err) {
      console.warn('Official bot loader unavailable, using Blockly fallback', err);
    }
    try {
      const B   = (window as any).Blockly;
      workspace = B?.derivWorkspace;
      if (!workspace) return false;
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

  const validateSharedBlockAssets = useCallback(async (bot: typeof FREE_BOTS[0], blockString: string) => {
    const assets = (bot as any).sharedBlockAssets || [];
    return Promise.all(assets.map(async (asset: { id: string; file: string }) => {
      // Uploaded Blockly SVG fragments are visual references, not loadable bot
      // XML and are not served as application routes. The executable bot keeps
      // each shared identifier in its <data> metadata, which is the source of
      // truth used for validation before loading.
      if (!blockString.includes(`>${asset.id}<`)) {
        throw new Error(`Shared block ${asset.id} is not present in ${bot.xmlFile}`);
      }
      return { id: asset.id, file: asset.file, ok: true };
    }));
  }, []);

  const autoRun = useCallback(async () => {
    const run_panel: any = store?.run_panel;
    if (!run_panel?.onRunButtonClick || run_panel.is_running) return;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        if (run_panel.is_running) return;
        await run_panel.onRunButtonClick();
        return;
      } catch {
        if (attempt < 5) await new Promise(r => setTimeout(r, isFastExecutionEnabled() ? 0 : 500));
      }
    }
  }, [store]);

  const handleLoadOnly = useCallback(async (bot: typeof FREE_BOTS[0]) => {
    setLoadingId(bot.id);
    try {
      const res = await fetch(bot.xmlFile);
      if (!res.ok) throw new Error(`Failed to fetch ${bot.xmlFile}`);
      const xml = await res.text();
      await validateSharedBlockAssets(bot, xml);
      (window as any).__pendingBotXml  = xml;
      (window as any).__pendingBotName = bot.name;
      store?.dashboard?.setActiveTab?.(DBOT_TABS.BOT_BUILDER);
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
      store?.dashboard?.setActiveTab?.(DBOT_TABS.BOT_BUILDER);
    } finally {
      setLoadingId(null);
    }
  }, [store, loadXmlIntoWorkspace, validateSharedBlockAssets]);

  const handleLoadAndRun = useCallback(async (bot: typeof FREE_BOTS[0]) => {
    setTradeContext({ page: 'Free Bots', bot: bot.name });
    setLoadingId(bot.id);
    try {
      const res = await fetch(bot.xmlFile);
      if (!res.ok) throw new Error(`Failed to fetch ${bot.xmlFile}`);
      const xml = await res.text();
      await validateSharedBlockAssets(bot, xml);
      (window as any).__pendingBotXml  = xml;
      (window as any).__pendingBotName = bot.name;
      store?.dashboard?.setActiveTab?.(DBOT_TABS.BOT_BUILDER);
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
      if (loaded) setTimeout(() => autoRun(), isFastExecutionEnabled() ? 0 : 900);
    } catch (e) {
      console.error('Load & Run error', e);
      store?.dashboard?.setActiveTab?.(DBOT_TABS.BOT_BUILDER);
    } finally {
      setLoadingId(null);
    }
  }, [store, loadXmlIntoWorkspace, autoRun, validateSharedBlockAssets]);

  // ── Market Killer Prime V1 — Direct Purchase ────────────────────────────────
  const mkpPurchase = useCallback(async () => {
    if (mkpInFlightRef.current) return;
    const api = (api_base as any)?.api;
    if (!api) { setMkpResult({ ok: false, msg: '❌ Not connected to Deriv' }); return; }

    mkpInFlightRef.current = true;
    setMkpLoading(true);
    setMkpResult(null);
    setMkpLastOutcome(null);

    const symbol     = MKP_MARKETS[mkpMarketIdxRef.current].symbol;
    const stake      = mkpStakeRef.current;
    const ticks      = mkpTicksRef.current;

    try {
      // 1. Get proposal
      const pr = await api.send({
        proposal: 1, amount: stake, basis: 'stake',
        contract_type: 'DIGITOVER',
        currency: 'USD',
        duration: ticks, duration_unit: 't',
        underlying_symbol: symbol,
        barrier: '2',
      });
      if (pr?.error) throw new Error(pr.error.message);
      const proposalId = pr?.proposal?.id;
      const askPrice   = Number(pr?.proposal?.ask_price ?? stake);
      if (!proposalId) throw new Error('No proposal received');

      // 2. Buy
      const buyRes = await api.send({ buy: proposalId, price: askPrice });
      if (buyRes?.error) throw new Error(buyRes.error.message);
      const contractId = buyRes?.buy?.contract_id;
      setMkpResult({ ok: true, msg: `✅ Contract #${contractId} opened on ${MKP_MARKETS[mkpMarketIdxRef.current].label}` });
      setMkpContractOpen(true);

      // 3. Subscribe to settlement
      try {
        const settleSub = api.subscribe({ proposal_open_contract: 1, contract_id: Number(contractId), subscribe: 1 });
        settleSub.subscribe({
          next: (res: any) => {
            const poc = res?.proposal_open_contract;
            if (!poc) return;
            if (poc.status === 'won' || poc.status === 'lost') {
              const won    = poc.status === 'won';
              const profit = Number(poc.profit ?? 0);
              setMkpContractOpen(false);
              setMkpLastOutcome(won ? 'won' : 'lost');
              setMkpResult({
                ok: won,
                msg: won
                  ? `🏆 WON +${profit.toFixed(2)} USD`
                  : `❌ LOST ${Math.abs(profit).toFixed(2)} USD`,
              });
              try { settleSub.unsubscribe?.(); } catch {}

              // Auto-restart
              if (mkpAutoRestartRef.current) {
                if (mkpRestartRef.current) clearTimeout(mkpRestartRef.current);
                if (mkpSwitchRef.current) {
                  // Rotate to next market
                  const nextIdx = (mkpMarketIdxRef.current + 1) % MKP_MARKETS.length;
                  setMkpMarketIdx(nextIdx);
                  mkpMarketIdxRef.current = nextIdx;
                }
                mkpRestartRef.current = setTimeout(() => {
                  mkpInFlightRef.current = false;
                  setMkpResult(null);
                  mkpPurchase();
                }, mkpDelayRef.current * 1000);
              }
            }
          },
          error: () => { try { settleSub.unsubscribe?.(); } catch {} },
        });
      } catch { /* settlement sub non-fatal */ }

    } catch (e: any) {
      setMkpResult({ ok: false, msg: `❌ ${e.message ?? 'Purchase failed'}` });
    } finally {
      mkpInFlightRef.current = false;
      setMkpLoading(false);
      // Auto-clear error result after 6 s (won/lost result stays longer)
      setTimeout(() => setMkpResult(prev => (prev && !prev.ok && prev.msg.startsWith('❌ ')) ? null : prev), 6000);
    }
  }, []);

  const mkpCancel = useCallback(() => {
    if (mkpRestartRef.current) { clearTimeout(mkpRestartRef.current); mkpRestartRef.current = null; }
    setMkpAutoRestart(false);
    setMkpResult(null);
    setMkpLastOutcome(null);
  }, []);

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
            className={`free-bots__card ${loadedId === bot.id ? 'free-bots__card--loaded' : ''} ${bot.id === 'market-killer-prime-v1' && mkpOpen ? 'free-bots__card--prime-active' : ''}`}
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

            {/* Standard buttons for all bots */}
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

            {/* Extra "Configure & Trade" button only for Market Killer Prime V1 */}
            {bot.id === 'market-killer-prime-v1' && (
              <button
                className={`free-bots__load-btn free-bots__load-btn--prime ${mkpOpen ? 'active' : ''}`}
                onClick={() => setMkpOpen(o => !o)}
                title='Open Purchase & Restart panel'
                style={{ marginTop: '0.3rem', width: '100%' }}
              >
                {mkpOpen ? '✕ Close Panel' : '⚡ Configure & Trade'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Market Killer Prime V1 — Purchase & Restart Panel ─────────────────── */}
      {mkpOpen && (
        <div className='mkp-panel'>
          <div className='mkp-panel__header'>
            <span className='mkp-panel__icon'>👑</span>
            <div>
              <h2 className='mkp-panel__title'>Market Killer Prime V1 — Trade Control</h2>
              <p className='mkp-panel__subtitle'>DIGIT OVER 2 · Martingale 2.2x · V25 1s default</p>
            </div>
            <button className='mkp-panel__close' onClick={() => { setMkpOpen(false); mkpCancel(); }}>✕</button>
          </div>

          <div className='mkp-panel__body'>
            {/* ── Purchase Block ────────────────────────────── */}
            <div className='mkp-block mkp-block--purchase'>
              <div className='mkp-block__label'>
                <span className='mkp-block__icon'>⚡</span>
                <span>PURCHASE BLOCK</span>
                <span className='mkp-block__badge'>MANUAL BUY</span>
              </div>

              <div className='mkp-fields'>
                {/* Market selector */}
                <div className='mkp-field'>
                  <label>Market</label>
                  <div className='mkp-market-pills'>
                    {MKP_MARKETS.map((m, i) => (
                      <button
                        key={m.symbol}
                        className={`mkp-pill ${mkpMarketIdx === i ? 'active' : ''}`}
                        onClick={() => setMkpMarketIdx(i)}
                        disabled={mkpLoading || mkpContractOpen}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stake + Ticks row */}
                <div className='mkp-field-row'>
                  <div className='mkp-field'>
                    <label>Stake (USD)</label>
                    <div className='mkp-input-row'>
                      <button className='mkp-stepper' onClick={() => setMkpStake(s => Math.max(0.35, +(s - 0.5).toFixed(2)))} disabled={mkpLoading || mkpContractOpen}>−</button>
                      <input
                        type='number' className='mkp-input' value={mkpStake} min={0.35} step={0.5}
                        onChange={e => setMkpStake(Math.max(0.35, +parseFloat(e.target.value || '0.35').toFixed(2)))}
                        disabled={mkpLoading || mkpContractOpen}
                      />
                      <button className='mkp-stepper' onClick={() => setMkpStake(s => +(s + 0.5).toFixed(2))} disabled={mkpLoading || mkpContractOpen}>+</button>
                    </div>
                  </div>
                  <div className='mkp-field'>
                    <label>Ticks</label>
                    <div className='mkp-input-row'>
                      <button className='mkp-stepper' onClick={() => setMkpTicks(t => Math.max(1, t - 1))} disabled={mkpLoading || mkpContractOpen}>−</button>
                      <input
                        type='number' className='mkp-input' value={mkpTicks} min={1} max={10} step={1}
                        onChange={e => setMkpTicks(Math.max(1, Math.min(10, parseInt(e.target.value || '1'))))}
                        disabled={mkpLoading || mkpContractOpen}
                      />
                      <button className='mkp-stepper' onClick={() => setMkpTicks(t => Math.min(10, t + 1))} disabled={mkpLoading || mkpContractOpen}>+</button>
                    </div>
                  </div>
                  <div className='mkp-field'>
                    <label>Barrier</label>
                    <div className='mkp-static-val'>OVER 2</div>
                  </div>
                </div>

                {/* Contract status / outcome indicator */}
                {mkpContractOpen && (
                  <div className='mkp-status mkp-status--open'>
                    <span className='mkp-status__dot' /> Contract live — waiting for settlement…
                  </div>
                )}
                {mkpLastOutcome && !mkpContractOpen && (
                  <div className={`mkp-status mkp-status--${mkpLastOutcome}`}>
                    {mkpLastOutcome === 'won' ? '🏆 WIN' : '❌ LOSS'}
                  </div>
                )}

                {/* Result toast */}
                {mkpResult && (
                  <div className={`mkp-result ${mkpResult.ok ? 'mkp-result--win' : 'mkp-result--loss'}`}>
                    {mkpResult.msg}
                  </div>
                )}

                <button
                  className={`mkp-buy-btn ${mkpLoading ? 'loading' : ''} ${mkpContractOpen ? 'waiting' : ''}`}
                  onClick={mkpPurchase}
                  disabled={mkpLoading || mkpContractOpen}
                >
                  {mkpContractOpen ? '⏳ Contract live…' : mkpLoading ? '⏳ Placing order…' : `⚡ BUY NOW — DIGIT OVER 2 @ ${MKP_MARKETS[mkpMarketIdx].label}`}
                </button>
                <p className='mkp-hint'>Places a single direct DIGIT OVER 2 contract. No bot scan needed.</p>
              </div>
            </div>

            {/* ── Trade Restart Block ────────────────────────── */}
            <div className='mkp-block mkp-block--restart'>
              <div className='mkp-block__label'>
                <span className='mkp-block__icon'>🔄</span>
                <span>TRADE RESTART</span>
                <span className={`mkp-block__badge ${mkpAutoRestart ? 'mkp-block__badge--on' : ''}`}>
                  {mkpAutoRestart ? 'AUTO-ON' : 'MANUAL'}
                </span>
              </div>

              <div className='mkp-fields'>
                {/* Auto-restart toggle */}
                <div className='mkp-toggle-row'>
                  <span>Auto Restart after settlement</span>
                  <button
                    className={`mkp-toggle ${mkpAutoRestart ? 'on' : 'off'}`}
                    onClick={() => setMkpAutoRestart(e => !e)}
                  >
                    <span className='mkp-toggle__knob' />
                  </button>
                </div>

                {mkpAutoRestart && (
                  <>
                    {/* Delay */}
                    <div className='mkp-field'>
                      <label>Restart Delay (seconds)</label>
                      <div className='mkp-input-row'>
                        <button className='mkp-stepper' onClick={() => setMkpDelay(d => Math.max(0, d - 1))}>−</button>
                        <input
                          type='number' className='mkp-input' value={mkpDelay} min={0} max={300}
                          onChange={e => setMkpDelay(Math.max(0, parseInt(e.target.value || '0')))}
                        />
                        <button className='mkp-stepper' onClick={() => setMkpDelay(d => d + 1)}>+</button>
                      </div>
                    </div>

                    {/* Market switch toggle */}
                    <div className='mkp-toggle-row'>
                      <span>Switch market on each restart</span>
                      <button
                        className={`mkp-toggle ${mkpSwitchMarket ? 'on' : 'off'}`}
                        onClick={() => setMkpSwitchMarket(e => !e)}
                      >
                        <span className='mkp-toggle__knob' />
                      </button>
                    </div>

                    {mkpSwitchMarket && (
                      <p className='mkp-hint'>
                        Rotates: {MKP_MARKETS.map(m => m.label).join(' → ')} on each restart.
                        Currently on <strong>{MKP_MARKETS[mkpMarketIdx].label}</strong>.
                      </p>
                    )}

                    <p className='mkp-hint'>
                      After each trade settles, waits {mkpDelay}s then auto-buys again
                      {mkpSwitchMarket ? ', switching market each cycle' : ''}.
                    </p>

                    <button className='mkp-cancel-btn' onClick={mkpCancel}>
                      ⏹ Cancel Auto-Restart
                    </button>
                  </>
                )}

                {/* Manual restart button (always visible when not auto) */}
                {!mkpAutoRestart && (
                  <button
                    className='mkp-restart-btn'
                    onClick={mkpPurchase}
                    disabled={mkpLoading || mkpContractOpen}
                  >
                    🔄 BUY AGAIN NOW
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default FreeBots;
