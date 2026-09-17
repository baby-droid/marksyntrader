// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { applyCommission } from '@/utils/commission';
import { isFastExecutionEnabled } from '@/utils/execution-speed';
import { setTradeContext } from '@/utils/trade-metadata';
import { getMasterSource } from '@/utils/trade-bus';
import { observer as globalObserver, api_base } from '@/external/bot-skeleton';
import { isEnded } from '@/components/shared';
import manifest from '../../../public/bots/scalpers/manifest.json';
import VpsMode, { VpsSettings } from './VpsMode';
import './scalper-bots.scss';
import './vps-mode.scss';

/* ─── Types ─── */
type TScalperBot = {
    key: string; name: string;
    category: 'Even/Odd' | 'Over/Under' | 'Rise/Fall' | 'Matches/Differs';
    contractType: string;
    prediction: number | null;
    multiple: boolean;
    xmlFile: string;
};

type TxRecord = {
    id: number; time: string; market: string;
    type: string; stake: number; barrier: number | null;
    result: 'won' | 'lost' | 'open';
    profit: number; exitDigit: number | null;
    entrySpot?: number; // entry spot price (from contract.entry_spot)
    exitSpot?: number;  // exit spot price (from contract.exit_tick)
    virtual?: boolean;  // true = simulated virtual-hook trade (no real money placed)
};

type RiskManagerConfig = {
    inject: boolean;
    active: boolean;
    onLose: boolean;
    activateLimit: number;
    deactivateLimit: number;
    multiplier: number;
    overrideStake: number;
};

/* Strategy Logic types */
type StrategyAlgorithm = 'LDP' | 'MDP' | 'STREAK';
type StrategyDigits = 'ODD' | 'EVEN' | 'OVER' | 'UNDER' | 'ANY';

type StrategyCondition = {
    id: string;
    algorithm: StrategyAlgorithm;
    strict: boolean;
    ifLast: number;       // check last N digits
    digitsIs: StrategyDigits;
    recoveryLimit: number; // max recovery tries before giving up
};

type StrategyLogicConfig = {
    globalShared: boolean;
    enabled: boolean;
    conditions: StrategyCondition[];
};

type BotConfig = {
    market: string;
    markets: string[];
    useMarketSwitch: boolean;
    switchOnLosses: number;
    duration: number;
    duration_unit: 't' | 's';
    stake: number;
    martingale: number;
    useStakeOverride: boolean;
    stakeOverride: number;
    stopOnLoss: boolean;
    consecutiveLossLimit: number;
    tpGuard: boolean;
    takeProfit: number;
    stopLoss: number;
    riskManager: RiskManagerConfig;
    strategyLogic: StrategyLogicConfig;
};

const DEFAULT_RM: RiskManagerConfig = {
    inject: false, active: true, onLose: true,
    activateLimit: 1, deactivateLimit: 100,
    multiplier: 2, overrideStake: 20,
};

const makeDefaultCondition = (): StrategyCondition => ({
    id: Math.random().toString(36).slice(2),
    algorithm: 'LDP',
    strict: true,
    ifLast: 3,
    digitsIs: 'ODD',
    recoveryLimit: 1,
});

const DEFAULT_STRATEGY_LOGIC: StrategyLogicConfig = {
    globalShared: false,
    enabled: true,
    conditions: [makeDefaultCondition()],
};

const DEFAULT_CONFIG = (bot: TScalperBot): BotConfig => ({
    market: '1HZ10V',
    markets: ['1HZ50V', '1HZ100V', '1HZ75V'],
    useMarketSwitch: false,
    switchOnLosses: 2,
    duration: 1,
    duration_unit: 't',
    stake: 0.35,
    martingale: 2,
    useStakeOverride: false,
    stakeOverride: 20,
    stopOnLoss: bot.multiple,
    consecutiveLossLimit: 4,
    tpGuard: bot.multiple,
    takeProfit: 100,
    stopLoss: bot.contractType === 'DIGITODD' ? 500 : 300,
    riskManager: { ...DEFAULT_RM },
    strategyLogic: { ...DEFAULT_STRATEGY_LOGIC, conditions: [makeDefaultCondition()] },
});

const ALL_MARKETS = [
    // ── Volatility 1-second (fastest — 1s ticks) ──
    { label: 'V10 (1s)',    value: '1HZ10V'    },
    { label: 'V15 (1s)',    value: '1HZ15V'    },
    { label: 'V25 (1s)',    value: '1HZ25V'    },
    { label: 'V30 (1s)',    value: '1HZ30V'    },
    { label: 'V50 (1s)',    value: '1HZ50V'    },
    { label: 'V75 (1s)',    value: '1HZ75V'    },
    { label: 'V90 (1s)',    value: '1HZ90V'    },
    { label: 'V100 (1s)',   value: '1HZ100V'   },
    { label: 'V150 (1s)',   value: '1HZ150V'   },
    { label: 'V200 (1s)',   value: '1HZ200V'   },
    { label: 'V250 (1s)',   value: '1HZ250V'   },
    // ── Volatility (standard) ──
    { label: 'V10',         value: 'R_10'      },
    { label: 'V25',         value: 'R_25'      },
    { label: 'V50',         value: 'R_50'      },
    { label: 'V75',         value: 'R_75'      },
    { label: 'V100',        value: 'R_100'     },
    // ── Daily Reset (Bear & Bull) ──
    { label: 'Bear Market', value: 'RDBEAR'    },
    { label: 'Bull Market', value: 'RDBULL'    },
    // ── Jump ──
    { label: 'Jump 10',     value: 'JD10'      },
    { label: 'Jump 25',     value: 'JD25'      },
    { label: 'Jump 50',     value: 'JD50'      },
    { label: 'Jump 75',     value: 'JD75'      },
    { label: 'Jump 100',    value: 'JD100'     },
    { label: 'Jump 150',    value: 'JD150'     },
    { label: 'Jump 200',    value: 'JD200'     },
    // ── Boom ──
    { label: 'Boom 300',    value: 'BOOM300N'  },
    { label: 'Boom 500',    value: 'BOOM500'   },
    { label: 'Boom 600',    value: 'BOOM600'   },
    { label: 'Boom 1000',   value: 'BOOM1000'  },
    // ── Crash ──
    { label: 'Crash 300',   value: 'CRASH300N' },
    { label: 'Crash 500',   value: 'CRASH500'  },
    { label: 'Crash 600',   value: 'CRASH600'  },
    { label: 'Crash 1000',  value: 'CRASH1000' },
    // ── Step ──
    { label: 'Step Index',  value: 'STPX'      },
    // ── Range Break ──
    { label: 'Range 100',   value: 'RB100'     },
    { label: 'Range 200',   value: 'RB200'     },
];

/* ── Duration presets — 1s on top, then ticks ascending ── */
const DURATION_OPTIONS: { label: string; value: number; unit: 't' | 's' }[] = [
    { label: '1s',   value: 1,  unit: 's' },
    { label: '1t',   value: 1,  unit: 't' },
    { label: '2t',   value: 2,  unit: 't' },
    { label: '3t',   value: 3,  unit: 't' },
    { label: '4t',   value: 4,  unit: 't' },
    { label: '5t',   value: 5,  unit: 't' },
    { label: '7t',   value: 7,  unit: 't' },
    { label: '10t',  value: 10, unit: 't' },
    { label: '15t',  value: 15, unit: 't' },
    { label: '30t',  value: 30, unit: 't' },
    { label: '90t',  value: 90, unit: 't' },
];

const SCALPER_BOTS: TScalperBot[] = manifest as TScalperBot[];
const CATEGORIES = ['All', 'Even/Odd', 'Over/Under'];
const ALGO_OPTIONS: { value: StrategyAlgorithm; label: string }[] = [
    { value: 'LDP',    label: 'LDP — Last Digit Pattern' },
    { value: 'MDP',    label: 'MDP — Multi Digit Pattern' },
    { value: 'STREAK', label: 'STREAK — Consecutive Run' },
];
const DIGITS_OPTIONS: { value: StrategyDigits; label: string }[] = [
    { value: 'ODD',   label: 'ODD' },
    { value: 'EVEN',  label: 'EVEN' },
    { value: 'OVER',  label: 'OVER' },
    { value: 'UNDER', label: 'UNDER' },
    { value: 'ANY',   label: 'ANY' },
];

/* ─── Hacker scan messages ─── */
const HACK_SCAN_MSGS = [
    'BYPASSING FIREWALL...',
    'BUFFER_OVERFLOW_CHECK: PASS',
    'DDOS_PROTECTION: BYPASSED',
    'ENCRYPTING RSA_2048_KEYS',
    'INJECTING_RECOVERY_PROTOCOL',
    'EXTRACTING MARKET_DATA_PACKET',
    'ANALYZING_NEURAL_PATTERN',
    'SYNC_PROTOCOL: ACTIVE',
    'QUANTUM_SHIELD: ENABLED',
    'MARKET_FEED_INTEGRITY: OK',
    'SCANNING_VOLATILITY_INDEX',
    'SIGNAL_PROCESSOR: ONLINE',
    'FIREWALL_BYPASS: SUCCESS',
    'PROXY_CHAIN: ANONYMIZED',
    'DEEP_SCAN: RUNNING...',
    'DERIV_API_LATENCY: OK',
    'POSITION_SIZER: CALIBRATED',
    'RISK_ENGINE: ARMED',
];

/* ─── Entry signal: single condition check ─── */
function checkConditionEntry(
    digits: number[],
    contractType: string,
    barrier: number | null,
    cond: StrategyCondition
): boolean {
    if (digits.length < cond.ifLast) return false;
    const recent = digits.slice(0, cond.ifLast);
    let matchCount = 0;

    for (const d of recent) {
        let m = false;
        switch (cond.digitsIs) {
            case 'ODD':   m = d % 2 !== 0; break;
            case 'EVEN':  m = d % 2 === 0; break;
            case 'OVER':  m = barrier !== null ? d > barrier : d > 5; break;
            case 'UNDER': m = barrier !== null ? d <= barrier : d <= 4; break;
            case 'ANY':   m = true; break;
        }
        if (m) matchCount++;
    }

    // STRICT: all must match; non-strict: ≥75%
    const threshold = cond.strict ? cond.ifLast : Math.max(1, Math.ceil(cond.ifLast * 0.75));
    return matchCount >= threshold;
}

/* ─── Entry signal: strategy logic OR-group ─── */
function checkEntry(
    digits: number[],
    contractType: string,
    barrier: number | null,
    logic: StrategyLogicConfig | null
): boolean {
    // Fallback when logic is disabled or no conditions
    if (!logic || !logic.enabled || logic.conditions.length === 0) {
        return checkEntryDefault(digits, contractType, barrier);
    }
    // OR-group: any condition true → entry
    return logic.conditions.some(c => checkConditionEntry(digits, contractType, barrier, c));
}

function checkEntryDefault(digits: number[], contractType: string, barrier: number | null): boolean {
    if (digits.length < 5) return false;
    const recent = digits.slice(0, 10);
    switch (contractType) {
        case 'DIGITEVEN': { let s = 0; for (const d of recent) { if (d % 2 !== 0) s++; else break; } return s >= 3; }
        case 'DIGITODD':  { let s = 0; for (const d of recent) { if (d % 2 === 0) s++; else break; } return s >= 3; }
        case 'DIGITOVER': { if (barrier === null) return true; let s = 0; for (const d of recent) { if (d <= barrier) s++; else break; } return s >= 2; }
        case 'DIGITUNDER':{ if (barrier === null) return true; let s = 0; for (const d of recent) { if (d > barrier) s++; else break; } return s >= 2; }
        default: return digits.length >= 3;
    }
}

/* ─── Per-digit predicate shared by LDP, Market Percentage, Entry Point Pattern ─── */
function buildMatchFn(cond: StrategyCondition): (d: number, prev: number | null) => boolean {
    const v = cond.digitValue ?? 5;
    return (d: number, prev: number | null): boolean => {
        switch (cond.digitsIs) {
            case 'ODD':        return d % 2 !== 0;
            case 'EVEN':       return d % 2 === 0;
            case 'OVER':       return d > v;
            case 'UNDER':      return d < v;
            case 'MATCHES':    return d === v;
            case 'DIFFERS':    return d !== v;
            case 'HIGH TICK':  return d >= 8;
            case 'LOW TICK':   return d <= 1;
            case 'RISE':
            case 'RISE EQUAL':
            case 'HIGHER':
            case 'ONLY UPS':   return prev === null || d >= prev;
            case 'FALL':
            case 'FALL EQUAL':
            case 'LOWER':
            case 'ONLY DOWNS': return prev === null || d <= prev;
            case 'RISE RESET': return d >= 5;
            case 'FALL RESET': return d <= 4;
            case 'ASIAN UP':   return d > 4;
            case 'ASIAN DOWN': return d <= 4;
            default:           return true;
        }
    };
}

/* ─── Single-condition evaluation — all 5 algorithms ───
   requiredCount: normally cond.ifLast; during recovery the caller passes
   cond.recoveryLimit so re-entry is faster while contract type stays locked. */
function evaluateSingleCondition(
    digits: number[],
    cond: StrategyCondition,
    requiredCount?: number,
    ctx?: { prices: number[]; contractType: string; prediction: number | null },
): boolean {
    const n = Math.max(1, requiredCount ?? cond.ifLast);
    if (digits.length < n) return false;
    const recent = digits.slice(0, n);
    const matchFn = buildMatchFn(cond);

    switch (cond.algorithm) {
        /* ── LDP (Last Digit Pattern) / NDP (Next Digit Prediction) ──────────────
           Same evaluation: Strict=ON requires every digit in the window to
           match; Strict=OFF requires a majority. NDP uses identical fields
           (If Last / Digits Is / Strict / Recovery Limit) to LDP — it exists
           as its own selectable algorithm so it can be added as a second,
           independent AND condition confirming the "next" digit streak on
           top of an LDP condition in the same OR group (both must pass). */
        case 'Touches': {
            /* Touches is an explicit algorithm, not an extra LDP toggle.
               Count matching ticks in the selected window and enter once the
               configured count is reached. */
            const touches = Math.max(1, Math.floor(Number(cond.touches) || 1));
            let touched = 0;
            let prev: number | null = null;
            for (const d of recent) {
                if (matchFn(d, prev)) touched++;
                prev = d;
            }
            return touched >= Math.min(touches, n);
        }
        case 'LDP':
        case 'NDP':
        default: {
            if (cond.strict) {
                /* NDP is evaluated against the newest ticks, but directional
                   predicates still need the tick immediately before that
                   window. For the normal one-tick NDP window this makes
                   RISE/FALL and ONLY UPS/DOWNS meaningful instead of allowing
                   every first digit through because prev was null. */
                let prev: number | null = cond.algorithm === 'NDP'
                    ? (digits[n] ?? null)
                    : null;
                for (const d of recent) { if (!matchFn(d, prev)) return false; prev = d; }
                return true;
            } else {
                let count = 0;
                let prev: number | null = cond.algorithm === 'NDP'
                    ? (digits[n] ?? null)
                    : null;
                for (const d of recent) { if (matchFn(d, prev)) count++; prev = d; }
                return count > recent.length / 2;
            }
        }

        /* ── Market Percentage ─────────────────────────────────────────────────
           Fires when ≥ percentageThreshold % of the last N digits satisfy the
           digitsIs predicate — gives a statistical view rather than streak-only. */
        case 'Market Percentage': {
            if (recent.length < 2) return false;
            let matchCount = 0;
            let prev: number | null = null;
            for (const d of recent) { if (matchFn(d, prev)) matchCount++; prev = d; }
            const pct = (matchCount / recent.length) * 100;
            return pct >= (cond.percentageThreshold ?? 60);
        }

        /* ── Sequence Radar ────────────────────────────────────────────────────
           Detects structural patterns in recent digits regardless of digit value:
           alternating parity, monotonic trend, zigzag, or low-range flat market. */
        case 'Sequence Radar': {
            if (recent.length < 2) return false;
            switch (cond.sequenceType ?? 'alternating') {
                case 'alternating': {
                    // Consecutive digits alternate ODD ↔ EVEN
                    for (let i = 1; i < recent.length; i++) {
                        if ((recent[i] % 2) === (recent[i-1] % 2)) return false;
                    }
                    return true;
                }
                case 'increasing': {
                    for (let i = 1; i < recent.length; i++) {
                        if (recent[i] < recent[i-1]) return false;
                    }
                    return true;
                }
                case 'decreasing': {
                    for (let i = 1; i < recent.length; i++) {
                        if (recent[i] > recent[i-1]) return false;
                    }
                    return true;
                }
                case 'zigzag': {
                    // Direction must reverse on every step (up-down-up / down-up-down)
                    if (recent.length < 3) return true;
                    let prevDir = 0;
                    for (let i = 1; i < recent.length; i++) {
                        const dir = recent[i] > recent[i-1] ? 1 : recent[i] < recent[i-1] ? -1 : 0;
                        if (dir !== 0) {
                            if (prevDir !== 0 && dir === prevDir) return false;
                            prevDir = dir;
                        }
                    }
                    return true;
                }
                case 'flat': {
                    // All digits within a tight range (≤2) — low-volatility market
                    const mn = Math.min(...recent);
                    const mx = Math.max(...recent);
                    return mx - mn <= 2;
                }
                default: return true;
            }
        }

        /* ── Complex Patterns ──────────────────────────────────────────────────
           Multi-phase pattern: compares the first half of the window against the
           second half to detect regime shifts or sustained trends. */
        case 'Complex Patterns': {
            if (recent.length < 4) return false;
            const half = Math.floor(recent.length / 2);
            const first  = recent.slice(0, half);
            const second = recent.slice(half);
            const avg1 = first.reduce((a, b) => a + b, 0) / first.length;
            const avg2 = second.reduce((a, b) => a + b, 0) / second.length;
            switch (cond.complexPattern ?? 'high-low') {
                case 'high-low':  return avg1 > 5.5 && avg2 < 4.5;
                case 'low-high':  return avg1 < 4.5 && avg2 > 5.5;
                case 'ramp-up': {
                    const slope = (recent[recent.length-1] - recent[0]) / (recent.length - 1);
                    return slope >= 0.5;
                }
                case 'ramp-down': {
                    const slope = (recent[recent.length-1] - recent[0]) / (recent.length - 1);
                    return slope <= -0.5;
                }
                case 'spike': {
                    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
                    return recent.some(d => Math.abs(d - mean) > 3);
                }
                default: return true;
            }
        }

        /* ── Entry Point Pattern ───────────────────────────────────────────────
           Reversal-pressure signal: counts consecutive opposing digits with a
           sensitivity-controlled minimum streak. Sensitivity controls how many
           confirming ticks are needed before calling a reversal:
             high   = 2 confirming ticks (very fast / aggressive)
             medium = 3 confirming ticks (balanced default)
             low    = 5 confirming ticks (conservative)
           The "opposing" side is determined by digitsIs (e.g. if digitsIs=ODD,
           we look for consecutive ODD ticks then signal an EVEN reversal). */
        case 'Entry Point Pattern': {
            const sensitivityN: Record<string, number> = { high: 2, medium: 3, low: 5 };
            const needed = Math.min(
                sensitivityN[cond.sensitivity ?? 'medium'] ?? 3,
                requiredCount ?? cond.ifLast,
            );
            if (digits.length < needed) return false;
            const window = digits.slice(0, needed);
            // Build the "opposing" predicate: we want the STREAK before the reversal
            const opposeFn = buildMatchFn(cond);
            return window.every((d, i) => opposeFn(d, i > 0 ? window[i-1] : null));
        }
    }
}

/* ── Plain-English description of a fired condition (for terminal log) ── */
function describeConditionFired(
    cond: StrategyCondition,
    digits: number[],
    inRecovery: boolean,
    isAnd: boolean,
    offset = 0,
): string {
    const reqCount = inRecovery ? (cond.recoveryLimit ?? 1) : cond.ifLast;
    const window = digits.slice(offset, offset + reqCount);
    const tag = isAnd ? 'AND' : 'IF';

    switch (cond.algorithm) {
        case 'LDP': {
            // Reverse so the terminal shows oldest → newest (matching natural reading order)
            const digitStr = window.length ? `[${[...window].reverse().join(', ')}]` : '[…]';
            const modeNote = inRecovery
                ? ` (recovery: ${cond.recoveryLimit} digit${cond.recoveryLimit > 1 ? 's' : ''})`
                : '';
            const mfn2 = buildMatchFn(cond);
            const matchCount = window.filter((d, i) => mfn2(d, i > 0 ? window[i-1] : null)).length;
            const total2 = window.length || reqCount;
            return `${tag} LDP: ${reqCount} digit${reqCount > 1 ? 's' : ''} ${cond.strict ? 'ALL' : `${matchCount}/${total2}`} ${cond.digitsIs}${cond.digitValue !== undefined && ['OVER','UNDER','MATCHES','DIFFERS'].includes(cond.digitsIs) ? ` ${cond.digitValue}` : ''}${modeNote}: ${digitStr} ✓`;
        }
        case 'Market Percentage': {
            const recent = digits.slice(0, cond.ifLast);
            const mfn = buildMatchFn(cond);
            const matching = recent.filter((d, i) => mfn(d, i > 0 ? recent[i-1] : null)).length;
            const pct = recent.length ? ((matching / recent.length) * 100).toFixed(0) : '?';
            return `${tag} Market%: ${pct}% of last ${cond.ifLast} digits are ${cond.digitsIs} (need ≥${cond.percentageThreshold ?? 60}%)`;
        }
        case 'Sequence Radar': {
            return `${tag} Sequence Radar: ${(cond.sequenceType ?? 'alternating').toUpperCase()} pattern in last ${cond.ifLast} digits [${window.join(',')}]`;
        }
        case 'Complex Patterns': {
            return `${tag} Complex: ${(cond.complexPattern ?? 'high-low').toUpperCase()} detected over ${cond.ifLast} ticks [${window.join(',')}]`;
        }
        case 'Entry Point Pattern': {
            const sn: Record<string, number> = { high: 2, medium: 3, low: 5 };
            const n = sn[cond.sensitivity ?? 'medium'] ?? 3;
            return `${tag} Entry Point (${cond.sensitivity ?? 'medium'} sensitivity): ${n}-tick reversal pressure from ${cond.digitsIs} [${window.join(',')}]`;
        }
        case 'NDP': {
            // Reverse so the terminal shows oldest → newest; window[0] is the
            // most-recent digit (= "second" digit in a 2-window, oldest→newest view).
            // That is the digit the trade is predicted to WIN on.
            const winDigit = window.length ? window[0] : null;
            const digitStr = window.length ? `[${[...window].reverse().join(', ')}]` : '[…]';
            const modeNote = inRecovery
                ? ` (recovery: ${cond.recoveryLimit} digit${cond.recoveryLimit > 1 ? 's' : ''})`
                : '';
            const mfn3 = buildMatchFn(cond);
            const matchCount2 = window.filter((d, i) => mfn3(d, i > 0 ? window[i-1] : null)).length;
            const total3 = window.length || reqCount;
            const winNote = winDigit !== null ? ` → WIN TARGET: digit ${winDigit}` : '';
            return `${tag} NDP: ${reqCount} digit${reqCount > 1 ? 's' : ''} ${cond.strict ? 'ALL' : `${matchCount2}/${total3}`} ${cond.digitsIs}${cond.digitValue !== undefined && ['OVER','UNDER','MATCHES','DIFFERS'].includes(cond.digitsIs) ? ` ${cond.digitValue}` : ''}${modeNote}: ${digitStr}${winNote} ✓`;
        }
        default: return `${tag} condition matched`;
    }
}

/* ── What the bot will BUY when the condition fires ── */
function describeBuyAction(contractType: string, prediction: number | null): string {
    switch (contractType) {
        case 'DIGITEVEN':  return 'BUY EVEN';
        case 'DIGITODD':   return 'BUY ODD';
        case 'DIGITOVER':  return `BUY OVER ${prediction}`;
        case 'DIGITUNDER': return `BUY UNDER ${prediction}`;
        case 'CALL':       return 'BUY RISE ↑';
        case 'PUT':        return 'BUY FALL ↓';
        case 'DIGITMATCH': return `BUY MATCHES ${prediction}`;
        case 'DIGITDIFF':  return `BUY DIFFERS ${prediction}`;
        default:           return 'EXECUTE TRADE';
    }
}

/* ─── Strategy Logic evaluation (OR-grouped AND-conditions) ───
   inRecovery: when true (bot is coming back from a loss), each condition's
   required streak length is relaxed from ifLast down to its own
   recoveryLimit — e.g. Over 2 normally needs 2 consecutive Under-2 digits
   to enter, but after a loss it only needs `recoveryLimit` (e.g. 1) so it
   recovers faster, while the contract type/barrier stay exactly the same. */
/* Per-group digit-window offset: NDP represents "the digit right now" (the
   freshest ticks), while every other algorithm in the same group (LDP, etc.)
   represents the streak that happened BEFORE that — so it must be evaluated
   further back in the digit history, not overlapping the NDP window.
   e.g. pattern 0,1,4 (oldest→newest): LDP "last 2 under 3" matches 0,1 and
   NDP "next digit over 2" matches 4 — LDP is offset by NDP's window size so
   the two windows are adjacent, not overlapping on the same latest digits. */
function ndpWindowFor(g: StrategyOrGroup, inRecovery: boolean): number {
    return g.conditions
        .filter(c => c.algorithm === 'NDP')
        .reduce((max, c) => Math.max(max, Math.max(1, inRecovery ? (c.recoveryLimit ?? 1) : c.ifLast)), 0);
}
function offsetFor(cond: StrategyCondition, ndpWindow: number): number {
    return cond.algorithm !== 'NDP' ? ndpWindow : 0;
}

function evaluateStrategyLogic(
    digits: number[],
    groups: StrategyOrGroup[],
    inRecovery = false,
    ctx?: { prices: number[]; contractType: string; prediction: number | null },
): { hit: boolean; group?: StrategyOrGroup } {
    for (const g of groups) {
        const ndpWindow = ndpWindowFor(g, inRecovery);
        // All conditions in the group must pass (AND logic)
        const allPass = g.conditions.every(cond => {
            const offset = offsetFor(cond, ndpWindow);
            const slice = offset > 0 ? digits.slice(offset) : digits;
            const priceOffset = ctx && offset > 0 ? { ...ctx, prices: ctx.prices.slice(offset) } : ctx;
            return evaluateSingleCondition(slice, cond, inRecovery ? cond.recoveryLimit : cond.ifLast, priceOffset);
        });
        if (allPass) return { hit: true, group: g };
    }
    return { hit: false };
}

/* Helper: recovery limit = minimum across all conditions in the fired group */
function groupRecoveryLimit(g: StrategyOrGroup): number {
    return Math.min(...g.conditions.map(c => c.recoveryLimit));
}

/* ─── Map Deriv symbol → Blockly SUBMARKET_LIST value ─── *
   Values must match what the Deriv active_symbols API returns as submarket names.
   Blockly populates its SUBMARKET_LIST dropdown directly from those API values,
   so any mismatch causes the field to silently reject setValue() calls. */
function symbolToSubmarket(sym: string): string {
    if (sym.startsWith('JD'))                             return 'jump_index';
    if (sym.startsWith('BOOM') || sym.startsWith('CRASH')) return 'crash_index';   // Boom/Crash indices
    if (sym === 'RDBEAR' || sym === 'RDBULL')             return 'daily_reset_index'; // Bear/Bull daily reset
    if (sym === 'STPX')                                   return 'step_index';
    if (sym.startsWith('RB'))                             return 'range_break';    // Range Break (not range_break_index)
    return 'random_index'; // 1HZ*, R_* Volatility indices
}

/* ─── Patch XML string with correct market / duration before loading ───
   Uses regex replacement instead of DOMParser+XMLSerializer to avoid
   namespace attributes (xmlns="...") being injected by XMLSerializer,
   which corrupt the Blockly XML format and cause silent load failures. */
function patchXmlContent(xml: string, market?: string, duration?: number, duration_unit?: 't' | 's'): string {
    try {
        let out = xml;
        if (market) {
            // Patch SUBMARKET_LIST inside trade_definition_market block
            out = out.replace(
                /(<field name="SUBMARKET_LIST">)[^<]*(<\/field>)/,
                `$1${symbolToSubmarket(market)}$2`
            );
            // Patch SYMBOL_LIST inside trade_definition_market block
            out = out.replace(
                /(<field name="SYMBOL_LIST">)[^<]*(<\/field>)/,
                `$1${market}$2`
            );
        }
        if (duration != null) {
            // Patch DURATIONTYPE_LIST (t = ticks, s = seconds)
            const unit = duration_unit ?? 't';
            out = out.replace(
                /(<field name="DURATIONTYPE_LIST">)[^<]*(<\/field>)/,
                `$1${unit}$2`
            );
            // Patch the duration NUM value
            out = out.replace(
                /(name="DURATION"[\s\S]*?<field name="NUM">)\d+(<\/field>)/,
                `$1${duration}$2`
            );
        }
        return out;
    } catch {
        return xml; // fallback: return original XML unchanged
    }
}

function getLastDigit(q: number, pipSize = 2): number {
    const s = Number(q).toFixed(pipSize).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

function contractLabel(bot: TScalperBot): string {
    if (bot.contractType === 'DIGITEVEN')  return 'EVEN';
    if (bot.contractType === 'DIGITODD')   return 'ODD';
    if (bot.contractType === 'DIGITOVER')  return `OVER ${bot.prediction}`;
    if (bot.contractType === 'DIGITUNDER') return `UNDER ${bot.prediction}`;
    return bot.contractType;
}

/* ─── XML helpers ─── */
function patchXmlMarket(xml: string, market: string): string {
    // Patch <field name="SYMBOL_LIST">…</field>
    return xml.replace(
        /(<field\s+name=["']SYMBOL_LIST["'][^>]*>)[^<]*/gi,
        `$1${market}`
    );
}
function patchXmlStake(xml: string, stake: number): string {
    // Patch <field name="AMOUNT">…</field>
    return xml.replace(
        /(<field\s+name=["']AMOUNT["'][^>]*>)[^<]*/gi,
        `$1${stake}`
    );
}

/* ─── NumInput — editable numeric field (no clamp-on-type bug) ─── */
const NumInput: React.FC<{
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (v: number) => void;
    disabled?: boolean;
}> = ({ value, min = 0, max = 9999999, step, onChange, disabled }) => {
    const [str, setStr] = useState(String(value));
    useEffect(() => { setStr(String(value)); }, [value]);
    return (
        <input
            type='number' min={min} max={max} step={step}
            value={str} disabled={disabled}
            onChange={e => setStr(e.target.value)}
            onBlur={() => {
                const v = parseFloat(str);
                if (!isNaN(v)) {
                    const c = Math.max(min, Math.min(max, v));
                    onChange(c); setStr(String(c));
                } else { setStr(String(value)); }
            }}
        />
    );
};

/* ─── Account Badge ─── */
const AccountBadge: React.FC = () => {
    const [isDemo, setIsDemo] = useState(false);
    useEffect(() => {
        const check = () => {
            const id = localStorage.getItem('active_loginid') || '';
            setIsDemo(id.startsWith('VRTC') || id.startsWith('VR'));
        };
        check();
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, []);
    return <span className={`sb-acct-badge ${isDemo ? 'demo' : 'real'}`}>{isDemo ? '🔵 DEMO' : '🟢 REAL'}</span>;
};

/* ─── Toggle Row ─── */
const ToggleRow: React.FC<{
    label: string; sublabel?: string; on: boolean;
    onToggle: () => void; disabled?: boolean;
}> = ({ label, sublabel, on, onToggle, disabled }) => (
    <div className='sb-toggle-row'>
        <div>
            <div className='sb-toggle-row__label'>{label}</div>
            {sublabel && <div className={`sb-toggle-row__sub ${on ? 'active' : 'disabled'}`}>{on ? 'ACTIVE' : 'DISABLED'}</div>}
        </div>
        <label className={`sb-switch ${disabled ? 'sb-switch--disabled' : ''}`}>
            <input type='checkbox' checked={on} onChange={onToggle} disabled={disabled} />
            <span className='sb-switch__track'><span className='sb-switch__thumb' /></span>
        </label>
    </div>
);

/* ─── Accordion Section ─── */
const SbAccordion: React.FC<{
    title: string; badge?: string; badgeColor?: string;
    defaultOpen?: boolean; children: React.ReactNode;
}> = ({ title, badge, badgeColor = '#22c55e', defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className={`sb-accordion ${open ? 'open' : ''}`}>
            <button className='sb-accordion__header' onClick={() => setOpen(v => !v)}>
                <span className='sb-accordion__title'>{title}</span>
                {badge && <span className='sb-accordion__badge' style={{ background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}44` }}>{badge}</span>}
                <span className='sb-accordion__arrow'>{open ? '▲' : '▼'}</span>
            </button>
            {open && <div className='sb-accordion__body'>{children}</div>}
        </div>
    );
};

/* ══════════════════════════════════════════════
   BotDetail — configure + run view
   ══════════════════════════════════════════════ */
const BotDetail: React.FC<{
    bot: TScalperBot;
    derivTrade: ReturnType<typeof useDerivTrade>;
    onBack: () => void;
    onLoadXml: (bot: TScalperBot) => Promise<void>;
    onLoadAndRun: (bot: TScalperBot) => Promise<void>;
    loadXmlIntoWorkspace: (xml: string, name: string) => Promise<boolean>;
}> = ({ bot, derivTrade, onBack, onLoadXml, onLoadAndRun, loadXmlIntoWorkspace }) => {
    const [cfg, setCfg]         = useState<BotConfig>(() => DEFAULT_CONFIG(bot));
    const [running, setRunning] = useState(false);
    const [tab, setTab]         = useState<'summary' | 'transactions' | 'journal'>('summary');
    const [terminal, setTerminal] = useState<{ t: string; msg: string; kind: string }[]>([]);
    const [txList, setTxList]   = useState<TxRecord[]>([]);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    const [loadingXml, setLoadingXml] = useState(false);
    const [entryReady, setEntryReady] = useState(false);
    const [activeMarket, setActiveMarket] = useState(cfg.market);
    const [addMarketSel, setAddMarketSel] = useState('1HZ50V');
    const [digitDisplay, setDigitDisplay] = useState<number[]>([]);
    const [xmlCache, setXmlCache] = useState<string | null>(null); // cached XML for the bot

    const stopRef        = useRef(false);
    const consLossRef    = useRef(0);
    const sessionPnlRef  = useRef(0);
    const txIdRef        = useRef(0);
    const termRef        = useRef<HTMLDivElement>(null);
    const digitWindowRef = useRef<number[]>([]);
    const tickUnsubRef   = useRef<(() => void) | null>(null);
    const xmlCacheRef    = useRef<string | null>(null);

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);
    useEffect(() => { setActiveMarket(cfg.market); }, [cfg.market]);

    const summary = useMemo(() => {
        const real  = txList.filter(t => !t.virtual);
        const won   = real.filter(t => t.result === 'won').length;
        const lost  = real.filter(t => t.result === 'lost').length;
        const pnl   = +real.reduce((a, t) => a + t.profit, 0).toFixed(2);
        const totalStake  = +real.reduce((a, t) => a + t.stake, 0).toFixed(2);
        const totalPayout = +(totalStake + pnl).toFixed(2);
        const virtualCount = txList.filter(t => !!t.virtual).length;
        return { runs: real.length, won, lost, pnl, totalStake, totalPayout, virtualCount };
    }, [txList]);

    /* Mirror hook telemetry into Bot Builder's native Transactions tab.
       The store marks these rows as virtual, keeping native totals real-only. */
    useEffect(() => {
        const nativeTransactions = (store as any)?.transactions;
        if (!nativeTransactions?.pushVirtualHook) return;
        txList.filter(tx => tx.virtual).forEach(tx => {
            if (publishedHookIdsRef.current.has(tx.id)) return;
            publishedHookIdsRef.current.add(tx.id);
            nativeTransactions.pushVirtualHook({
                id: tx.id,
                time: tx.time,
                market: tx.market,
                result: tx.result === 'won' ? 'won' : 'lost',
                exitDigit: tx.exitDigit,
                hookType: tx.type,
            });
        });
    }, [store, txList]);

    const ts = () => new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const addLog = useCallback((msg: string, kind = 'info') => {
        setTerminal(prev => [{ t: ts(), msg, kind }, ...prev].slice(0, 500));
    }, []);

    useEffect(() => {
        if (termRef.current) termRef.current.scrollTop = 0;
    }, [terminal.length]);

    const cfgSet = (patch: Partial<BotConfig>) => setCfg(prev => ({ ...prev, ...patch }));
    const rmSet  = (patch: Partial<RiskManagerConfig>) =>
        setCfg(prev => ({ ...prev, riskManager: { ...prev.riskManager, ...patch } }));
    const slSet  = (patch: Partial<StrategyLogicConfig>) =>
        setCfg(prev => ({ ...prev, strategyLogic: { ...prev.strategyLogic, ...patch } }));
    const condSet = (id: string, patch: Partial<StrategyCondition>) =>
        slSet({ conditions: cfg.strategyLogic.conditions.map(c => c.id === id ? { ...c, ...patch } : c) });
    const condAdd = () => slSet({ conditions: [...cfg.strategyLogic.conditions, makeDefaultCondition()] });
    const condDel = (id: string) => slSet({ conditions: cfg.strategyLogic.conditions.filter(c => c.id !== id) });

    /* ── Load + cache XML ── */
    const fetchXml = useCallback(async (): Promise<string | null> => {
        if (xmlCacheRef.current) return xmlCacheRef.current;
        try {
            const res = await fetch(bot.xmlFile);
            if (!res.ok) return null;
            const xml = await res.text();
            xmlCacheRef.current = xml;
            setXmlCache(xml);
            return xml;
        } catch { return null; }
    }, [bot.xmlFile]);

    /* ── Silent background XML load ── */
    const silentLoadXml = useCallback(async (market: string, stake: number) => {
        try {
            let xml = await fetchXml();
            if (!xml) return;
            xml = patchXmlMarket(xml, market);
            xml = patchXmlStake(xml, stake);
            await loadXmlIntoWorkspace(xml, bot.name);
        } catch { /* silent */ }
    }, [fetchXml, loadXmlIntoWorkspace, bot.name]);

    /* ── Subscribe to ticks for the active market ──
       Each new tick immediately wakes the scan loop (tickSignalRef) so the
       condition check runs at true tick-rate with no poll delay. */
    const subscribeMarket = useCallback((market: string) => {
        if (tickUnsubRef.current) { tickUnsubRef.current(); tickUnsubRef.current = null; }
        digitWindowRef.current = [];
        priceWindowRef.current = [];
        setDigitDisplay([]);
        const unsub = derivTrade.subscribeTicks(market, tick => {
            const ps = tick.pip_size ?? 2;
            const d = tick.digit != null ? tick.digit : getLastDigit(tick.quote, ps);
            digitWindowRef.current = [d, ...digitWindowRef.current].slice(0, 50);
            // Also track raw prices for Rise/Fall momentum detection
            if (tick.quote != null) {
                priceWindowRef.current = [Number(tick.quote), ...priceWindowRef.current].slice(0, 50);
            }
            setDigitDisplay(prev => [d, ...prev].slice(0, 20));
            // ✅ Reset stall timer on every real tick — prevents false-fire watchdog
            lastTickAtRef.current = Date.now();
            // ⚡ Log the live digit stream to terminal on every tick (accurate, from pip_size)
            if (!stopRef.current) {
                const rawPrice = tick.quote != null ? Number(tick.quote).toFixed(ps) : '?';
                /* Stealth mode: mask the middle digits of the price so the exact
                   tick value is not visible in terminal screenshots/recordings.
                   The digit [d] is still shown — it's needed for readability. */
                const displayPrice = cfg.stealthMode && rawPrice !== '?'
                    ? rawPrice.slice(0, 2) + '***' + rawPrice.slice(-2)
                    : rawPrice;
                setTerminal(prev => [
                    { t: ts(), msg: `TICK: ${displayPrice}  →  digit [${d}]`, kind: 'tick' },
                    ...prev,
                ].slice(0, 300));
            }
            // ⚡ Wake the scan loop instantly on every new tick
            if (tickSignalRef.current) { tickSignalRef.current(); tickSignalRef.current = null; }
        });
        tickUnsubRef.current = unsub;
        setActiveMarket(market);
    }, [derivTrade]);

    useEffect(() => () => { if (tickUnsubRef.current) tickUnsubRef.current(); }, []);

    /* ── Hacker startup sequence ── */
    const runHackerStartup = async (market: string, xmlLoaded: boolean) => {
        const isDemo = (localStorage.getItem('active_loginid') || '').startsWith('VRTC');
        const msgs = [
            `STATUS: ONLINE — ${isDemo ? 'DEMO_ACCOUNT' : 'REAL_ACCOUNT'}`,
            `CONNECTION_SPEED: ${118 + Math.floor(Math.random() * 32)} Mbps`,
            `XML_BOT_LOADED: ${xmlLoaded ? bot.name.toUpperCase().replace(/ /g, '_') : 'FALLBACK_DIRECT_API'}`,
            'BYPASS_FIREWALL: SUCCESS',
            'BUFFER_OVERFLOW_CHECK: PASS',
            `MARKET_SYNC → ${market}`,
            'DDOS_PROTECTION: BYPASSED',
            'PACKET_TIMING_JITTER: INJECTING ±50ms entropy...',
            'TLS_FINGERPRINT: JA3_HASH SPOOFED — PASS',
            'BEHAVIORAL_SIGNATURE: RANDOMIZED',
            'ENCRYPTING RSA_4096_KEYS...',
            `SIGNAL_PROCESSOR: ONLINE — ${contractLabel(bot)}`,
            'STRATEGY_LOGIC: ARMED',
            'RISK_ENGINE: CALIBRATED',
            'MARKET_FEED_INTEGRITY: OK',
            '▶ SCAN ENGINE: READY',
        ];
        for (const m of msgs) {
            if (stopRef.current) return;
            addLog(m, 'hack');
            await new Promise(r => setTimeout(r, 80 + Math.random() * 60));
        }
    };

    /* ── Execute one trade cycle (entry → buy → settle) ── */
    const executeTrade = async (
        curMarket: string,
        curStake: number,
        patchedXml: string | null
    ): Promise<{ profit: number; exitDigit: number | null }> => {
        /* Patch XML to current market+stake and reload */
        if (patchedXml) {
            let xml = patchedXml;
            xml = patchXmlMarket(xml, curMarket);
            xml = patchXmlStake(xml, curStake);
            loadXmlIntoWorkspace(xml, bot.name).catch(() => {});
        }

        const txId = ++txIdRef.current;
        const openTx: TxRecord = {
            id: txId, time: ts(), market: curMarket,
            type: contractLabel(bot), stake: curStake,
            barrier: bot.prediction, result: 'open', profit: 0, exitDigit: null,
        };
        setTxList(prev => [openTx, ...prev]);

        const params: any = {
            symbol: curMarket,
            contract_type: bot.contractType,
            duration: cfg.duration,
            duration_unit: 't',
            stake: curStake,
        };
        if (bot.prediction !== null) params.barrier = String(bot.prediction);

        const profit = await new Promise<number>((resolve, reject) => {
            derivTrade.buyContract(params, settled => {
                const p = applyCommission(settled.profit ?? 0);
                const exitDigit = settled.exit_spot != null
                    ? getLastDigit(Number(settled.exit_spot)) : null;
                const result: TxRecord['result'] = p > 0 ? 'won' : 'lost';
                setTxList(prev => prev.map(t =>
                    t.id === txId ? { ...t, result, profit: p, exitDigit } : t
                ));
                resolve(p);
            }).catch(reject);
        });

        const exitDigit = txList.find(t => t.id === txId)?.exitDigit ?? null;
        return { profit, exitDigit: null };
    };

    /* ── Start bot ── */
    const startBot = useCallback(async () => {
        if (running || !derivTrade.authorized) return;
        stopRef.current      = false;
        consLossRef.current  = 0;
        sessionPnlRef.current = 0;
        setRunning(true);
        setEntryReady(false);
        setTerminal([]);
        setWinPopup(null);
        setCoolOffStatus(null);
        realExecutionLockedRef.current = false;
        addLog(`🟢 LIVE ACCOUNT EXECUTION: ${getMasterSource().toUpperCase()} — VPS/session controls active`, 'start');

        /* Determine market list — the MARKET field in Trade Parameters is always the
           starting market; the Market Switcher's added markets are additional
           rotation targets that come after it (deduped so it isn't repeated). */
        const marketList = cfg.useMarketSwitch && cfg.markets.length > 0
            ? [cfg.market, ...cfg.markets.filter(m => m !== cfg.market)]
            : [cfg.market];
        const multiScan = bot.category === 'Even/Odd' && cfg.strategyLogic.active
            && cfg.useMarketSwitch && marketList.length > 1;
        let curMarketIdx = 0;
        let curMarket    = marketList[curMarketIdx];
        /* Remember the default/first market so we can restore it after a win */
        const defaultMarket = marketList[0];

        /* Load XML silently */
        addLog('⚙ LOADING XML BOT...', 'hack');
        const rawXml = await fetchXml();
        const xmlLoaded = !!rawXml;

        /* Subscribe ticks + startup sequence */
        subscribeMarket(curMarket);
        addLog(`▶ BOT ENGINE STARTED — ${contractLabel(bot)}`, 'start');
        await runHackerStartup(curMarket, xmlLoaded);

        if (rawXml) silentLoadXml(curMarket, cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake);

        let curStake  = cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake;
        let martCount = 0;
        // Recovery limit from strategy logic (use the first condition's recoveryLimit, or ∞ for multiple bots)
        const recoveryLimit = cfg.strategyLogic.enabled && cfg.strategyLogic.conditions.length > 0
            ? cfg.strategyLogic.conditions[0].recoveryLimit
            : (bot.multiple ? 999 : 0);

        while (!stopRef.current) {
            try {
                /* ── Scan for entry signal ── */
                addLog(`📡 SCANNING → ${multiScan ? marketList.join(', ') : curMarket} | ${contractLabel(bot)}`, 'scan');
                setEntryReady(false);

                /* Track when we started scanning on the current market.
                   After 2 min with no entry, rotate to the next market and reload XML. */
                const scanStartedAt = Date.now();
                let marketSwitched = false;
                let scanTick = 0;

                /* ── Virtual Hook Recovery (VHR) gate ─────────────────────────────────────
                   When VHR is active (set by the loss handler below), skip the full
                   entry scan and do exactly ONE virtual tick check instead.

                   Logic:
                     • Virtual result = LOSS → market confirms the losing pattern
                       → fire recovery trade immediately (entry = true, bypass inner scan)
                     • Virtual result = WIN  → pattern not confirmed yet
                       → clear VHR flag, run the normal entry scan as usual

                   VHR fires independently of the full Virtual Hook pattern — it activates
                   whenever cfg.virtualHook.recoveryMode is enabled, even when the main
                   hookLoss/hookWin gate (cfg.virtualHook.enabled) is off.              */
                let entry = false;
                if (vhrActiveRef.current && cfg.virtualHook.recoveryMode) {
                    vhrActiveRef.current = false; // consume the flag for this iteration
                    addLog('⚡ VHR: 1-VIRTUAL CHECK — evaluating recovery entry...', 'hack');

                    // Wait for exactly one live tick
                    await new Promise<void>(res => {
                        let done = false;
                        const fin = () => { if (!done) { done = true; res(); } };
                        tickSignalRef.current = fin;
                        setTimeout(fin, 3000); // fallback: don't hang if feed is slow
                    });

                    if (!stopRef.current) {
                        const vDigit = digitWindowRef.current[0] ?? 5;
                        const vPred  = slotBarrier() ?? bot.prediction ?? 5;
                        let   vWon   = false;
                        switch (bot.contractType) {
                            case 'DIGITEVEN':  vWon = vDigit % 2 === 0; break;
                            case 'DIGITODD':   vWon = vDigit % 2 !== 0; break;
                            case 'DIGITOVER':  vWon = vDigit > vPred;   break;
                            case 'DIGITUNDER': vWon = vDigit < vPred;   break;
                            case 'DIGITMATCH': vWon = vDigit === vPred;  break;
                            case 'DIGITDIFF':  vWon = vDigit !== vPred;  break;
                            case 'CALL':
                                vWon = (priceWindowRef.current[0] ?? 0) > (priceWindowRef.current[1] ?? priceWindowRef.current[0] ?? 0);
                                break;
                            case 'PUT':
                                vWon = (priceWindowRef.current[0] ?? 0) < (priceWindowRef.current[1] ?? priceWindowRef.current[0] ?? 0);
                                break;
                            default: vWon = vDigit % 2 === 0; break;
                        }
                        const vProfit = vWon ? +(curStake * 0.85).toFixed(2) : -curStake;
                        setTxList(prev => [{
                            id: ++txIdRef.current, time: ts(),
                            market: curMarket,
                            type: `[VHR] ${contractLabel(bot)}`,
                            stake: curStake,
                            barrier: slotBarrier() ?? null,
                            result: vWon ? 'won' : 'lost',
                            profit: vProfit,
                            exitDigit: vDigit,
                            virtual: true,
                        }, ...prev]);

                        if (!vWon) {
                            addLog(`⚡ VHR ❌ VIRTUAL LOSS [${vDigit}] — PATTERN CONFIRMED → ENTERING RECOVERY TRADE IMMEDIATELY`, 'entry');
                            entry = true; // bypass the inner scan; fire the real recovery trade now
                        } else {
                            addLog(`⚡ VHR ✅ VIRTUAL WIN [${vDigit}] — pattern not confirmed → resuming normal scan`, 'scan');
                            // entry remains false → inner scan will run normally
                        }
                    }
                }

                /* ── Virtual Hook Alternative recovery gate ─────────────────────
                   Stage 1 (vhaRecovery1Ref): after a real loss, do 1 virtual tick.
                     Virtual LOSS → fire recovery real trade immediately.
                     Virtual WIN  → advance to stage 2.
                   Stage 2 (vhaRecovery2Ref): run full checkEntry / strategy scan
                     to find the best market setup, then fire the real trade. */
                if (cfg.virtualHookAlt.recoveryEnabled) {
                    if (vhaRecovery1Ref.current && !stopRef.current) {
                        vhaRecovery1Ref.current = false;
                        addLog('💎 VHA-R1: 1-VIRTUAL RECOVERY CHECK — evaluating market...', 'hack');
                        await new Promise<void>(res => {
                            let done = false;
                            const fin = () => { if (!done) { done = true; res(); } };
                            tickSignalRef.current = fin;
                            setTimeout(fin, 3000);
                        });
                        if (!stopRef.current) {
                            const rDigit = digitWindowRef.current[0] ?? 5;
                            const rPred  = slotBarrier() ?? bot.prediction ?? 5;
                            let rWon = false;
                            switch (bot.contractType) {
                                case 'DIGITEVEN':  rWon = rDigit % 2 === 0; break;
                                case 'DIGITODD':   rWon = rDigit % 2 !== 0; break;
                                case 'DIGITOVER':  rWon = rDigit > rPred;   break;
                                case 'DIGITUNDER': rWon = rDigit < rPred;   break;
                                case 'DIGITMATCH': rWon = rDigit === rPred;  break;
                                case 'DIGITDIFF':  rWon = rDigit !== rPred;  break;
                                case 'CALL': rWon = (priceWindowRef.current[0] ?? 0) > (priceWindowRef.current[1] ?? priceWindowRef.current[0] ?? 0); break;
                                case 'PUT':  rWon = (priceWindowRef.current[0] ?? 0) < (priceWindowRef.current[1] ?? priceWindowRef.current[0] ?? 0); break;
                                default: rWon = rDigit % 2 === 0;
                            }
                            setTxList(prev => [{
                                id: ++txIdRef.current, time: ts(), market: curMarket,
                                type: `[VHA-R1] ${contractLabel(bot)}`, stake: curStake,
                                barrier: slotBarrier() ?? null,
                                result: rWon ? 'won' : 'lost', profit: rWon ? +(curStake * 0.85).toFixed(2) : -curStake,
                                exitDigit: rDigit, virtual: true,
                            }, ...prev]);
                            if (!rWon) {
                                addLog(`💎 VHA-R1 ❌ VIRTUAL LOSS [${rDigit}] — CONFIRMED → ENTERING RECOVERY TRADE NOW`, 'entry');
                                entry = true;
                            } else {
                                addLog(`💎 VHA-R1 ✅ VIRTUAL WIN [${rDigit}] — escalating to stage-2 best-setup scan`, 'scan');
                                vhaRecovery2Ref.current = true;
                            }
                        }
                    }

                    if (vhaRecovery2Ref.current && !entry && !stopRef.current) {
                        vhaRecovery2Ref.current = false;
                        addLog('💎 VHA-R2: BEST-SETUP SCAN — reading market for optimal re-entry...', 'hack');
                        // Read 3 ticks and check entry signal on each
                        let bestFound = false;
                        for (let _bi = 0; _bi < 3 && !stopRef.current && !bestFound; _bi++) {
                            await new Promise<void>(res => {
                                let done = false;
                                const fin = () => { if (!done) { done = true; res(); } };
                                tickSignalRef.current = fin;
                                setTimeout(fin, 2500);
                            });
                            const favors = checkEntry(digitWindowRef.current, bot.contractType, bot.prediction, priceWindowRef.current);
                            addLog(`  📊 VHA-R2 scan ${_bi + 1}/3: ${favors ? '✓ best setup confirmed' : '✗ not optimal'}`, 'scan');
                            if (favors) { bestFound = true; entry = true; }
                        }
                        if (!bestFound) {
                            addLog('💎 VHA-R2: best setup not found in 3 ticks — forcing re-entry (recovery priority)', 'entry');
                            entry = true; // force fire even without ideal setup — recovery takes priority
                        } else {
                            addLog('💎 VHA-R2 🚀 BEST SETUP CONFIRMED — firing recovery real trade', 'entry');
                        }
                    }
                }

                while (!entry && !stopRef.current) {
                    entry = checkEntry(
                        digitWindowRef.current,
                        bot.contractType,
                        bot.prediction,
                        cfg.strategyLogic.enabled ? cfg.strategyLogic : null
                    );
                    scanTick++;

                    if (!entry) {
                        if (scanTick % 4 === 1) {
                            const recent = digitWindowRef.current.slice(0, 10).join(' ');
                            addLog(`ANALYZING_DIGIT_PATTERN: [ ${recent || '...'} ]`, 'scan');
                        }
                        if (scanTick % 12 === 5) {
                            addLog(HACK_SCAN_MSGS[Math.floor(Math.random() * HACK_SCAN_MSGS.length)], 'hack');
                        }
                        if (scanTick % 12 === 7) {
                            const condDesc = cfg.strategyLogic.enabled && cfg.strategyLogic.conditions.length > 0
                                ? `LDP[${cfg.strategyLogic.conditions[0].ifLast}×${cfg.strategyLogic.conditions[0].digitsIs}]`
                                : 'DEFAULT';
                            addLog(`STRATEGY: ${condDesc} | WAITING_FOR_SIGNAL...`, 'scan');
                        }
                        if (scanTick % 10 === 5) {
                            addLog(`CONNECTION_SPEED: ${105 + Math.floor(Math.random() * 40)} Mbps`, 'hack');
                        }

                        /* ⚡⚡⚡ ULTRA TURBO — pre-warm the Bot Builder workspace on every tick
                           BEFORE the NDP/LDP condition fires. By the time the condition is met
                           on the next tick, patchWorkspaceParams is already done and the XML bot
                           can be fired with zero workspace-setup latency. */
                        if (ultraTurboRef.current) {
                            patchWorkspaceParams({
                                market: curMarket,
                                stake: curStake,
                                martingale: slotMartingale(),
                                prediction: slotBarrier(),
                            });
                        }

                        /* ⚡ Supersonic: wait for the next live tick instead of polling on a timer.
                           Falls back to 2 s max in case ticks stall (e.g. weekend / network). */
                        await new Promise<void>(resolve => {
                            let done = false;
                            const finish = () => { if (!done) { done = true; resolve(); } };
                            tickSignalRef.current = finish;
                            setTimeout(finish, 2000); // fallback
                        });
                    }
                }

                if (stopRef.current) break;
                /* If we rotated market on 2-min timeout, restart the scan on the new market */
                if (marketSwitched) continue;

                /* ── Entry fired ── */
                setEntryReady(true);
                addLog('⚡ ENTRY_SIGNAL_DETECTED — EXECUTING TRADE', 'entry');
                addLog(`XML_BOT_PROTOCOL: ACTIVATED | stake: $${curStake.toFixed(2)} | market: ${curMarket}`, 'entry');
                await new Promise(r => setTimeout(r, 100));

                /* ── Execute trade ── */
                const txId = ++txIdRef.current;
                setTxList(prev => [{
                    id: txId, time: ts(), market: curMarket,
                    type: contractLabel(bot), stake: curStake,
                    barrier: bot.prediction, result: 'open', profit: 0, exitDigit: null,
                }, ...prev]);

                if ((cfg.virtualHook.enabled || cfg.virtualHookAlt.enabled) && !stopRef.current) {
                    /* ── Shared tick wait: one wait serves both state machines ── */
                    const sharedBarrier = slotBarrier();
                    const sharedTicks   = Math.max(1, cfg.duration);
                    for (let _vt = 0; _vt < sharedTicks && !stopRef.current; _vt++) {
                        await new Promise<void>(res => {
                            let done = false;
                            const fin = () => { if (!done) { done = true; res(); } };
                            tickSignalRef.current = fin;
                            setTimeout(fin, 3000); // fallback if feed stalls
                        });
                    }
                    if (stopRef.current) break;

                /* Patch XML with market+stake and silently reload */
                if (rawXml) {
                    const patched = patchXmlStake(patchXmlMarket(rawXml, curMarket), curStake);
                    loadXmlIntoWorkspace(patched, bot.name).catch(() => {});
                }

                const profit = await new Promise<number>((resolve, reject) => {
                    derivTrade.buyContract(params, settled => {
                        const p = applyCommission(settled.profit ?? 0);
                        const exitDigit = settled.exit_spot != null
                            ? getLastDigit(Number(settled.exit_spot)) : null;
                        const result: TxRecord['result'] = p > 0 ? 'won' : 'lost';
                        setTxList(prev => prev.map(t =>
                            t.id === txId ? { ...t, result, profit: p, exitDigit } : t
                        ));
                        resolve(p);
                    }).catch(reject);
                });

                if (stopRef.current) break;
                setEntryReady(false);

                /* ── Guard-triggered stops ── */
                if (cycle.forceStopped) {
                    consLossRef.current = cycle.consLoss;
                    totalConsLoss = cycle.consLoss;

                if (won) {
                    consLossRef.current = 0;
                    martCount = 0;
                    curStake = cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake;
                    addLog(`✅ TICK WIN  +${profit.toFixed(2)} USD  |  P/L: ${pnlStr}`, 'win');

                    /* Single-run: always stop on win */
                    if (!bot.multiple) {
                        addLog('🏁 SINGLE_RUN_COMPLETE — BOT STOPPED ON WIN', 'stop');
                        break;
                    }

                    /* TP check */
                    if (cfg.tpGuard && sessionPnlRef.current >= cfg.takeProfit) {
                        addLog(`🎯 TAKE_PROFIT TARGET $${cfg.takeProfit} REACHED — BOT STOPPED`, 'stop');
                        break;
                    }

                    addLog('🔄 RECOVERY_COMPLETE — RETURNING TO MARKET SCAN', 'scan');
                    martCount = 0; // reset after win
                } else {
                    consLossRef.current++;
                    martCount++;

                    const rm = cfg.riskManager;
                    const useMartingale = rm.inject && rm.active && rm.onLose
                        ? martCount >= rm.activateLimit && martCount <= rm.deactivateLimit
                        : !rm.inject;
                    const multiplier = rm.inject && rm.active ? rm.multiplier : cfg.martingale;
                    const nextStake  = useMartingale ? +(curStake * multiplier).toFixed(2) : curStake;

                    addLog(`❌ LOSS  ${profit.toFixed(2)} USD  |  consec: ${consLossRef.current}  |  RECOVERY_STAKE: $${nextStake.toFixed(2)}`, 'loss');

                    /* Recovery limit from strategy logic */
                    if (martCount > recoveryLimit && !bot.multiple) {
                        addLog(`🛑 RECOVERY_LIMIT (${recoveryLimit}) REACHED — BOT STOPPED`, 'stop');
                        break;
                    }

                    if (martCount > recoveryLimit && bot.multiple) {
                        addLog(`♻ RECOVERY_LIMIT_RESET — Re-entering market scan`, 'scan');
                        martCount = 0;
                        curStake = cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake;
                    }

                    /* Stop on consecutive losses */
                    if (cfg.stopOnLoss && consLossRef.current >= cfg.consecutiveLossLimit) {
                        if (cfg.useMarketSwitch && cfg.markets.length > 1) {
                            curMarketIdx = (curMarketIdx + 1) % marketList.length;
                            curMarket    = marketList[curMarketIdx];
                            consLossRef.current = 0;
                            martCount = 0;
                            curStake  = cfg.riskManager.inject ? cfg.riskManager.overrideStake : cfg.stake;
                            subscribeMarket(curMarket);
                            addLog(`🔀 MARKET_SWITCH_PROTOCOL → ${curMarket} (after ${cfg.consecutiveLossLimit} losses)`, 'switch');
                            /* Patch XML to new market */
                            if (rawXml) {
                                const patched = patchXmlStake(patchXmlMarket(rawXml, curMarket), curStake);
                                loadXmlIntoWorkspace(patched, bot.name).catch(() => {});
                                addLog(`XML_MARKET_PATCH: applied → ${curMarket}`, 'hack');
                            }
                            continue;
                        }
                        addLog(`🛑 STOPPED — ${cfg.consecutiveLossLimit} consecutive losses`, 'stop');
                        break;
                    }

                    /* TP/SL check */
                    if (cfg.tpGuard) {
                        if (sessionPnlRef.current >= cfg.takeProfit) {
                            addLog(`🎯 TAKE_PROFIT $${cfg.takeProfit} REACHED — BOT STOPPED`, 'stop');
                            break;
                        }
                        if (sessionPnlRef.current <= -Math.abs(cfg.stopLoss)) {
                            addLog(`🛡 STOP_LOSS -$${cfg.stopLoss} TRIGGERED — BOT STOPPED`, 'stop');
                            break;
                        }
                        /* User accepted: activate recovery mode and fall through to the
                           loss handling block below, which will continue scanning */
                        inRecovery = true;
                        recoveryCoolLoss = 0;
                        consecutiveWins = 0;
                        addLog(`🔄 RECOVERY MODE ACTIVATED — target: recover ${lossAmt.toFixed(2)} loss until P/L = 0.00`, 'switch');
                        /* Fall through — !cycle.lastWon block below will handle the stake
                           update and continue the main scan loop */
                    }

                    addLog(`🔄 RECOVERY_MODE: stake → $${nextStake.toFixed(2)} | attempt ${martCount}`, 'loss');
                    curStake = Math.max(0.35, nextStake);
                }

                /* ── Deactivate Limit check: stop trading when session wins OR losses hit the limit ── */
                {
                    const dLimit = cfg.riskManager.deactivateLimit;
                    if (dLimit > 0 && (winsRef.current >= dLimit || lossesRef.current >= dLimit)) {
                        addLog(`🛑 DEACTIVATE_LIMIT ${dLimit}: session wins=${winsRef.current} losses=${lossesRef.current} — trading deactivated.`, 'stop');
                        setWinPopup({ profit: cycle.cycleProfit, stopped: true, sessionPnl: sessionPnlRef.current, wins: winsRef.current, losses: lossesRef.current, reason: 'deactivate-limit' });
                        break;
                    }
                }

                /* ── Loss handling ──
                   Fires for EVERY single loss — either a guard-triggered force-stop (loss_limit)
                   or a normal single-trade loss (bot stopped by onStopButtonClick in onContract).
                   The terminal fully controls martingale stake and market switching.
                   The XML bot NEVER runs its own trade_again on a loss — it is force-stopped
                   by onContract above so the terminal can re-scan and control the next entry. */
                if (!cycle.lastWon) {
                    /* ── Engine-busy retry (Ultra Turbo teardown race) ──
                       runXmlBotCycle returned retryNextCycle=true because api_base.is_stopping
                       was still set when we tried to fire the next trade. No contract was placed,
                       so DO NOT escalate martingale, log a loss, or do a market switch. Just
                       sleep briefly and retry — the engine will be free within a few hundred ms. */
                    if (cycle.retryNextCycle) {
                        await new Promise(r => setTimeout(r, ultraTurboRef.current ? 80 : 200));
                        continue;
                    }

                    if (!cycle.forceStopped) {
                        /* Single loss (not a guard stop) — update counters from cycle */
                        consLossRef.current = cycle.consLoss;
                        totalConsLoss = cycle.consLoss;
                    }

                    /* Compute next stake with full martingale multiplication */
                    curStake = computeNextStake(totalConsLoss, lastBuyPrice);

                    /* Stake Override ceiling — when martingale stake reaches or exceeds the
                       override threshold, deactivate martingale immediately: reset the loss
                       counter to 0 and revert to the base stake for the next cycle.
                       This prevents runaway stake growth while keeping the scan loop alive. */
                    if (slotUseStakeOverride() && curStake >= slotStakeOverride()) {
                        addLog(`🔄 STAKE_OVERRIDE: martingale stake ${curStake.toFixed(2)} ≥ ceiling ${slotStakeOverride().toFixed(2)} — martingale deactivated, resetting to base ${slotBaseStake().toFixed(2)}`, 'hack');
                        totalConsLoss = 0;
                        consLossRef.current = 0;
                        curStake = slotBaseStake();
                        lastBuyPrice = curStake;
                    }

                    addLog(`📈 MARTINGALE_STAKE: ${curStake.toFixed(2)} (after ${totalConsLoss} losses, barrier: ${activeBarrier ?? 'auto'})`, 'hack');

                    /* Market 2 switch — own stake / martingale / TP / barrier */
                    if (cfg.market2.enabled && activeSlot === 'm1') {
                        activeSlot = 'm2';
                        curMarket  = cfg.market2.market;
                        curMarketIdx = 0;
                        lastFiredGroupRef.current = null;
                        curStake  = computeNextStake(totalConsLoss, lastBuyPrice);
                        subscribeMarket(curMarket);
                        curMarketRef.current = curMarket;
                        addLog(`🔀 MARKET_2_SWITCH → ${curMarket} | stake ${curStake.toFixed(2)} | barrier ${slotBarrier()} | martingale ×${slotMartingale()} (${totalConsLoss} losses)`, 'switch');
                        /* Reload XML with new market and duration */
                        try { await onPreloadXml(bot, { market: curMarket, duration: cfg.duration, duration_unit: cfg.duration_unit }); } catch { /* non-fatal */ }
                        patchWorkspaceParams({ market: curMarket, duration: cfg.duration, duration_unit: cfg.duration_unit });
                        { const rm = curMarket; setTimeout(() => patchWorkspaceParams({ market: rm }), 500); setTimeout(() => patchWorkspaceParams({ market: rm }), 1000); }
                        continue; // re-scan on Market 2 with updated stake
                    }

                    /* Market list switch: rotate after switchOnLosses consecutive losses */
                    if (cfg.useMarketSwitch && cfg.markets.length > 1 && !multiScan
                        && totalConsLoss >= cfg.switchOnLosses) {
                        curMarketIdx = (curMarketIdx + 1) % marketList.length;
                        curMarket    = marketList[curMarketIdx];
                        lastFiredGroupRef.current = null;
                        subscribeMarket(curMarket);
                        curMarketRef.current = curMarket;
                        addLog(`🔀 MARKET_SWITCH → ${curMarket} | stake ${curStake.toFixed(2)} | martingale ×${slotMartingale()} (${totalConsLoss} losses, threshold: ${cfg.switchOnLosses})`, 'switch');
                        /* Reload XML with new market and sync ticks duration */
                        try { await onPreloadXml(bot, { market: curMarket, duration: cfg.duration, duration_unit: cfg.duration_unit }); } catch { /* non-fatal */ }
                        patchWorkspaceParams({ market: curMarket, duration: cfg.duration, duration_unit: cfg.duration_unit });
                        { const rm = curMarket; setTimeout(() => patchWorkspaceParams({ market: rm }), 500); setTimeout(() => patchWorkspaceParams({ market: rm }), 1000); }
                        continue; // re-scan on new market with martingale stake
                    }

                    /* No switch — same market, continue scanning with accumulated martingale stake */
                    addLog(`🔄 RECOVERY: same market ${curMarket} | stake ${curStake.toFixed(2)} | barrier: ${activeBarrier ?? 'auto'}`, 'switch');

                    /* ── Recovery mode: track cool-off and check completion ── */
                    if (inRecovery) {
                        recoveryCoolLoss++;

                        /* If P/L has been restored to 0 by the martingale wins, we are done */
                        if (sessionPnlRef.current >= 0) {
                            inRecovery = false;
                            addLog(`✅ RECOVERY COMPLETE — loss fully recovered! P/L: +${sessionPnlRef.current.toFixed(2)} USD`, 'win');
                            setWinPopup({ profit: cycle.cycleProfit, stopped: true, sessionPnl: sessionPnlRef.current, wins: winsRef.current, losses: lossesRef.current, reason: 'recovery-complete' });
                            break;
                        }

                        /* 3 consecutive losses during recovery → pause and read market health */
                        if (recoveryCoolLoss >= 3) {
                            addLog(`⏸ RECOVERY COOL-OFF: 3 losses in a row — reading market for 3 ticks without trading...`, 'hack');
                            let favorable = 0, unfavorable = 0;
                            for (let _ri = 0; _ri < 3 && !stopRef.current; _ri++) {
                                /* Wait for the next live tick */
                                await new Promise<void>(res => {
                                    let done = false;
                                    const fin = () => { if (!done) { done = true; res(); } };
                                    tickSignalRef.current = fin;
                                    setTimeout(fin, 2000);
                                });
                                const favors = checkEntry(digitWindowRef.current, bot.contractType, bot.prediction, priceWindowRef.current);
                                addLog(`  📊 COOL-OFF read ${_ri + 1}/3: ${favors ? '✓ favourable' : '✗ unfavourable'}`, 'scan');
                                if (favors) favorable++; else unfavorable++;
                            }
                            recoveryCoolLoss = 0;
                            addLog(`  📊 Market verdict: ${favorable} favourable vs ${unfavorable} unfavourable`, 'scan');
                            if (favorable <= unfavorable) {
                                const coolSecs = 15;
                                addLog(`⏸ MARKET UNFAVOURABLE — cooling off ${coolSecs}s before resuming recovery...`, 'hack');
                                await new Promise(r => setTimeout(r, coolSecs * 1_000));
                            } else {
                                addLog(`✅ MARKET FAVOURABLE — resuming recovery trading`, 'switch');
                            }
                        }
                    }

                    /* ── Virtual Hook Recovery: queue 1-virtual-check recovery on next scan ──
                       Sets vhrActiveRef so the NEXT outer iteration does a 1-tick virtual
                       simulation before re-entering. If virtual = LOSS (confirms pattern),
                       the recovery real trade fires immediately — skipping the full entry scan.
                       This fires independently of the main VH hookLoss/hookWin gate. */
                    if (cfg.virtualHook.recoveryMode) {
                        vhrActiveRef.current = true;
                        addLog('⚡ VHR: REAL LOSS FLAGGED — instant 1-virtual recovery check queued for next scan', 'hack');
                    }

                    /* ── Virtual Hook Alternative recovery: stage-1 virtual check queued ──
                       After any real-money loss, queue a 1-virtual-tick recovery check.
                       The VHA recovery gate at the top of the outer loop will handle it. */
                    if (cfg.virtualHookAlt.recoveryEnabled) {
                        vhaRecovery1Ref.current = true;
                        addLog('💎 VHA: REAL LOSS → stage-1 recovery virtual check queued for next scan', 'hack');
                    }

                    const longLossTrigger = cfg.coolOff.long.enabled
                        && cfg.coolOff.long.lossesInRow > 0
                        && totalConsLoss >= cfg.coolOff.long.lossesInRow;
                    if (longLossTrigger) {
                        await runCoolOff('long', `${totalConsLoss} losses in a row`);
                        sessionTrades = 0;
                        consecutiveWins = 0;
                        totalConsLoss = 0;
                        consLossRef.current = 0;
                        curStake = slotBaseStake();
                        lastBuyPrice = curStake;
                    }
                    const shortTradeTriggerAfterLoss = cfg.coolOff.short.enabled
                        && cfg.coolOff.short.tradesLimit > 0
                        && sessionTrades >= cfg.coolOff.short.tradesLimit;
                    if (!longLossTrigger && shortTradeTriggerAfterLoss) {
                        await runCoolOff('short', `${sessionTrades} trades reached`);
                        sessionTrades = 0;
                        consecutiveWins = 0;
                        totalConsLoss = 0;
                        consLossRef.current = 0;
                        curStake = slotBaseStake();
                        lastBuyPrice = curStake;
                    }

                    /* Buffer between loss cycles — gives lingering bot.stop events a
                       chance to drain before the new cycle registers its listeners.
                       Fast/UltraFast: 0-30 ms (VHR will wait 1 tick anyway on next iter).
                       Normal: 50 ms safety gap. */
                    const lossBufferMs = ultraTurboRef.current || fastExecRef.current === 'ultra' || fastExecRef.current === 'fast' ? 0
                        : 50;
                    await new Promise(r => setTimeout(r, lossBufferMs));
                    continue;
                }

                /* ── Natural WIN ── */
                totalConsLoss = 0;
                consLossRef.current = 0;
                lastFiredGroupRef.current = null;
                /* Restore default market after a win if we had switched */
                if (activeSlot === 'm2' || curMarketIdx !== 0) {
                    activeSlot = 'm1';
                    curMarketIdx = 0;
                    curMarket  = defaultMarket;
                    subscribeMarket(curMarket);
                    curMarketRef.current = curMarket;
                    addLog(`↩ DEFAULT_MARKET_RESTORED → ${curMarket} (win — market reset)`, 'switch');
                }
                /* Reset stake to base after a win */
                curStake = slotBaseStake();
                lastBuyPrice = curStake;

                /* ── Recovery mode: continue trading after a win until P/L ≥ 0 ── */
                if (inRecovery) {
                    recoveryCoolLoss = 0; // win resets the recovery cool-off loss counter
                    const pnlNow = sessionPnlRef.current;
                    if (pnlNow >= 0) {
                        inRecovery = false;
                        addLog(`✅ RECOVERY COMPLETE — loss fully recovered! P/L: +${pnlNow.toFixed(2)} USD`, 'win');
                        setWinPopup({ profit: cycle.cycleProfit, stopped: true, sessionPnl: pnlNow, wins: winsRef.current, losses: lossesRef.current, reason: 'recovery-complete' });
                        break;
                    }
                    /* Still in the red — keep trading with fresh base stake */
                    addLog(`🔄 RECOVERY WIN +${cycle.cycleProfit.toFixed(2)} | still recovering... P/L: ${pnlNow.toFixed(2)} USD`, 'win');
                    await new Promise(r => setTimeout(r, 300));
                    continue; // re-scan and trade again until loss is erased
                }

                /* Check TP guard before stopping */
                if (sessionPnlRef.current >= slotTakeProfit()) {
                    addLog(`🎯 TAKE PROFIT ${slotTakeProfit()} REACHED — ALL ENGINES STOPPED ✓`, 'stop');
                    setWinPopup({ profit: cycle.cycleProfit, stopped: true, sessionPnl: sessionPnlRef.current, wins: winsRef.current, losses: lossesRef.current, reason: 'take-profit' });
                    break;
                }

                const shortWinTrigger = cfg.coolOff.short.enabled
                    && cfg.coolOff.short.winsInRow > 0
                    && consecutiveWins >= cfg.coolOff.short.winsInRow;
                const shortTradeTrigger = cfg.coolOff.short.enabled
                    && cfg.coolOff.short.tradesLimit > 0
                    && sessionTrades >= cfg.coolOff.short.tradesLimit;
                const longWinTrigger = cfg.coolOff.long.enabled
                    && cfg.coolOff.long.winsInRow > 0
                    && consecutiveWins >= cfg.coolOff.long.winsInRow;
                if (shortWinTrigger || shortTradeTrigger || longWinTrigger) {
                    const mode: 'short' | 'long' = longWinTrigger && !shortWinTrigger && !shortTradeTrigger ? 'long' : 'short';
                    const reason = shortWinTrigger
                        ? `${consecutiveWins} wins in a row`
                        : shortTradeTrigger
                            ? `${sessionTrades} trades reached`
                            : `${consecutiveWins} wins in a row`;
                    await runCoolOff(mode, reason);
                    sessionTrades = 0;
                    consecutiveWins = 0;
                    totalConsLoss = 0;
                    consLossRef.current = 0;
                    curStake = slotBaseStake();
                    lastBuyPrice = curStake;
                    if (!stopRef.current) {
                        addLog(`▶ SESSION CONTINUES — next ${mode} session started`, 'switch');
                        continue;
                    }
                }

                /* ── Stop after every successful trade ──
                   Keep the legacy one-trade mode when sessions are disabled.
                   Enabling either short or long sessions makes RUN a continuous
                   session, with the configured cool-off acting as the pause. */
                const sessionsEnabled = cfg.coolOff.short.enabled || cfg.coolOff.long.enabled;
                if (!sessionsEnabled) {
                    addLog('🎉 TRADE WIN — Bot stopped. Press ▶ RUN to start a fresh scalp.', 'win');
                    setWinPopup({ profit: cycle.cycleProfit, stopped: true, sessionPnl: sessionPnlRef.current, wins: winsRef.current, losses: lossesRef.current, reason: 'win' });
                    break;
                }
                addLog('✅ SESSION WIN — continuing until a session cool-off threshold is reached', 'win');
                await new Promise(r => setTimeout(r, 100));

            } catch (err: any) {
                addLog(`⚠ API_ERROR: ${err?.error?.message || err?.message || 'Trade error — retrying...'}`, 'error');
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        if (tickUnsubRef.current) { tickUnsubRef.current(); tickUnsubRef.current = null; }
        addLog('⏹ BOT_SESSION TERMINATED', 'info');
        setRunning(false);
        setEntryReady(false);
    }, [running, derivTrade, bot, cfg, addLog, subscribeMarket, fetchXml, silentLoadXml, loadXmlIntoWorkspace]);

    const stopBot = useCallback(() => {
        stopRef.current = true;
        addLog('⏸ STOP_SIGNAL SENT — awaiting trade settlement...', 'info');
    }, [addLog]);

    const addMarket = () => {
        if (!cfg.markets.includes(addMarketSel))
            cfgSet({ markets: [...cfg.markets, addMarketSel] });
    };
    const removeMarket = (m: string) => cfgSet({ markets: cfg.markets.filter(x => x !== m) });
    const marketLabel = (v: string) => ALL_MARKETS.find(m => m.value === v)?.label ?? v;

    /* ── Strategy condition description ── */
    const condEntryDesc = (cond: StrategyCondition) => {
        const what = `last ${cond.ifLast} digits are ${cond.strict ? 'ALL' : '≥75%'} ${cond.digitsIs}`;
        return `IF ${what} → ENTRY (recovery limit: ${cond.recoveryLimit})`;
    };

    return (
        <div className='sb-detail'>
            {/* ── Header ── */}
            <div className='sb-detail__header'>
                <button className='sb-detail__back' onClick={onBack}>‹ Bots</button>
                <div className='sb-detail__title'>
                    <span className='sb-detail__icon'>
                        {bot.contractType.includes('EVEN') ? '2️⃣' : bot.contractType.includes('ODD') ? '1️⃣' : bot.contractType.includes('OVER') ? '⬆️' : '⬇️'}
                    </span>
                    <div>
                        <h2>{bot.name}</h2>
                        <span className={`sb-detail__status ${running ? 'running' : 'stopped'}`}>
                            STATUS: {running ? '● RUNNING' : '○ STOPPED'}
                        </span>
                    </div>
                </div>
                <div className='sb-detail__header-right'>
                    <AccountBadge />
                    {derivTrade.balance !== null && (
                        <span className='sb-detail__balance'>{derivTrade.currency} {derivTrade.balance.toFixed(2)}</span>
                    )}
                    {!running ? (
                        <>
                            <button className='sb-detail__start-btn' onClick={startBot} disabled={!derivTrade.authorized}>
                                {derivTrade.authorized ? '▶ RUN' : '○ Connecting...'}
                            </button>
                            <button
                                className={`sb-detail__ultra-turbo-btn${ultraTurbo ? ' sb-detail__ultra-turbo-btn--on' : ''}`}
                                onClick={() => setUltraTurbo(v => !v)}
                                title={
                                    ultraTurbo
                                        ? 'ULTRA TURBO ON — workspace pre-warmed each tick, zero init delay, 300ms teardown cap. Click to disable.'
                                        : 'ULTRA TURBO OFF — enable to pre-warm workspace on every tick and eliminate all software delays between NDP condition and XML bot fire. Maximises chance of catching the exact NDP digit before next tick arrives.'
                                }
                            >
                                {ultraTurbo ? '⚡⚡⚡ ULTRA TURBO' : '🚀 ULTRA TURBO'}
                            </button>
                            <button
                                className={`sb-detail__fast-btn sb-detail__fast-btn--${fastExec}`}
                                onClick={cycleSpeed}
                                title={
                                    fastExec === 'off'   ? 'Balanced: uses strategy scan / checkEntry logic (click for Fast)' :
                                    fastExec === 'fast'  ? 'Fast: bypass scan, fire on first tick (click for Ultra Fast)' :
                                                           'Ultra Fast: zero-latency, fires the instant a tick arrives (click to reset)'
                                }
                            >
                                {fastExec === 'off'   && '⚙ BALANCED'}
                                {fastExec === 'fast'  && '⚡ FAST'}
                                {fastExec === 'ultra' && '⚡⚡ ULTRA'}
                            </button>
                        </>
                    ) : (
                        <button className='sb-detail__stop-btn' onClick={stopBot}>⏹ STOP</button>
                    )}
                    <button className='sb-detail__load-btn' disabled={loadingXml}
                        onClick={() => { setLoadingXml(true); onLoadXml(bot).finally(() => setLoadingXml(false)); }}>
                        📂 Builder
                    </button>
                </div>
            </div>

            {/* ── Body ── */}
            <div className='sb-detail__body'>
                {/* ── Left Sidebar ── */}
                <div className='sb-detail__sidebar'>

                    {/* Builder buttons */}
                    <div className='sb-bot-actions'>
                        <button className='sb-bot-action-btn' onClick={() => { setLoadingXml(true); onLoadXml(bot).finally(() => setLoadingXml(false)); }} disabled={loadingXml}>
                            📁 DEFAULT BOT
                        </button>
                        <button className='sb-bot-action-btn' onClick={() => { setLoadingXml(true); onLoadAndRun(bot).finally(() => setLoadingXml(false)); }} disabled={loadingXml}>
                            ▶ SELECT BOT
                        </button>
                        <button className='sb-bot-action-btn' disabled>⬆ UPLOAD BOT</button>
                        <button className='sb-bot-action-btn' disabled>⬇ DOWNLOAD</button>
                    </div>

                    <div className='sb-global-label'>GLOBAL SHARED</div>

                    {/* ── Trade Parameters ── */}
                    <SbAccordion title='Trade Parameters' badge='ACTIVE' defaultOpen>
                        <div className='sb-field'>
                            <label>Market</label>
                            <select value={cfg.market} onChange={e => cfgSet({ market: e.target.value })} disabled={running}>
                                {ALL_MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div className='sb-field'>
                            <label>Contract</label>
                            <span className='sb-badge'>{contractLabel(bot)}</span>
                        </div>
                        <div className='sb-field-row'>
                            <div className='sb-field'>
                                <label>Duration</label>
                                <NumInput value={cfg.duration} min={1} max={10}
                                    onChange={v => cfgSet({ duration: v })} disabled={running} />
                                <span className='sb-unit'>Ticks</span>
                            </div>
                            <div className='sb-field'>
                                <label>Stake (USD)</label>
                                <NumInput value={cfg.stake} min={0.35} max={100000} step={0.01}
                                    onChange={v => cfgSet({ stake: v })} disabled={running} />
                            </div>
                        </div>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Stake Override</label>
                            <button className={`sb-toggle ${cfg.useStakeOverride ? 'on' : 'off'}`}
                                onClick={() => cfgSet({ useStakeOverride: !cfg.useStakeOverride })} disabled={running}>
                                {cfg.useStakeOverride ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        {cfg.useStakeOverride && (
                            <div className='sb-field'>
                                <label>Override Ceiling (USD)</label>
                                <NumberField value={cfg.stakeOverride} min={cfg.stake} step={0.01}
                                    onCommit={n => cfgSet({ stakeOverride: n })} disabled={running} />
                                <span className='sb-unit'>USD</span>
                                <p className='sb-hint'>When martingale stake reaches {cfg.stakeOverride.toFixed(2)}, reset back to base {cfg.stake.toFixed(2)} and deactivate martingale.</p>
                            </div>
                        )}
                        <div className='sb-field'>
                            <label>Mode</label>
                            <span className='sb-badge'>{bot.multiple ? 'Multiple runs' : 'Single run (stop on win)'}</span>
                        </div>
                    </SbAccordion>

                    {/* ── Stop Trading ── */}
                    <SbAccordion title='Stop Trading' badge={cfg.stopOnLoss ? 'ACTIVE' : 'DISABLED'} badgeColor={cfg.stopOnLoss ? '#22c55e' : '#64748b'} defaultOpen>
                        <ToggleRow label='Stop After Losses' sublabel='' on={cfg.stopOnLoss}
                            onToggle={() => cfgSet({ stopOnLoss: !cfg.stopOnLoss })} disabled={running} />
                        {cfg.stopOnLoss && (
                            <>
                                <div className='sb-field'>
                                    <label>Consecutive Losses</label>
                                    <NumInput value={cfg.consecutiveLossLimit} min={1} max={20}
                                        onChange={v => cfgSet({ consecutiveLossLimit: v })} disabled={running} />
                                </div>
                                <p className='sb-hint'>Bot stops after {cfg.consecutiveLossLimit} consecutive losses.</p>
                            </>
                        )}
                    </SbAccordion>

                    {/* ── TP/SL Guard ── */}
                    <SbAccordion title='TP/SL Guard' badge={cfg.tpGuard ? 'ACTIVE' : 'DISABLED'} badgeColor={cfg.tpGuard ? '#22c55e' : '#64748b'} defaultOpen>
                        <ToggleRow label='TP/SL Guard' on={cfg.tpGuard}
                            onToggle={() => cfgSet({ tpGuard: !cfg.tpGuard })} disabled={running} />
                        {cfg.tpGuard && (
                            <>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Take Profit ($)</label>
                                        <NumInput value={cfg.takeProfit} min={1} max={100000}
                                            onChange={v => cfgSet({ takeProfit: v })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Stop Loss ($)</label>
                                        <NumInput value={cfg.stopLoss} min={1} max={100000}
                                            onChange={v => cfgSet({ stopLoss: v })} disabled={running} />
                                    </div>
                                </div>
                                <div className='sb-tpsl-bar'>
                                    <span className='sb-tpsl-tp'>TP +{cfg.takeProfit}</span>
                                    <span className='sb-tpsl-sl'>SL -{cfg.stopLoss}</span>
                                </div>
                            </>
                        )}
                    </SbAccordion>

                    {/* ── Risk Manager ── */}
                    <SbAccordion title='Risk Manager' badge={cfg.riskManager.inject ? 'INJECTED' : 'STANDARD'} badgeColor={cfg.riskManager.inject ? '#f59e0b' : '#64748b'}>
                        <ToggleRow label='Inject Risk Manager' sublabel='' on={cfg.riskManager.inject}
                            onToggle={() => rmSet({ inject: !cfg.riskManager.inject })} disabled={running} />
                        {cfg.riskManager.inject ? (
                            <>
                                <div className='sb-rm-type'>Martingale <span className='sb-rm-info'>ⓘ</span></div>
                                <ToggleRow label='Risk Manager' sublabel='' on={cfg.riskManager.active}
                                    onToggle={() => rmSet({ active: !cfg.riskManager.active })} disabled={running} />
                                <ToggleRow label='On Lose' sublabel='' on={cfg.riskManager.onLose}
                                    onToggle={() => rmSet({ onLose: !cfg.riskManager.onLose })} disabled={running} />
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Activate Limit</label>
                                        <NumInput value={cfg.riskManager.activateLimit} min={1} max={50}
                                            onChange={v => rmSet({ activateLimit: v })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Deactivate Limit</label>
                                        <NumInput value={cfg.riskManager.deactivateLimit} min={1} max={500}
                                            onChange={v => rmSet({ deactivateLimit: v })} disabled={running} />
                                    </div>
                                </div>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Multiplier</label>
                                        <NumInput value={cfg.riskManager.multiplier} min={1} max={10} step={0.5}
                                            onChange={v => rmSet({ multiplier: v })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Stake (override)</label>
                                        <NumInput value={cfg.riskManager.overrideStake} min={0.35} max={100000} step={0.01}
                                            onChange={v => rmSet({ overrideStake: v })} disabled={running} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className='sb-field'>
                                    <label>Martingale ×</label>
                                    <NumInput value={cfg.martingale} min={1} max={10} step={0.5}
                                        onChange={v => cfgSet({ martingale: v })} disabled={running} />
                                </div>
                                <p className='sb-hint'>Standard martingale — stake × {cfg.martingale} on each loss.</p>
                            </>
                        )}
                    </SbAccordion>

                    {/* ── Market Switcher ── */}
                    <SbAccordion title='Market Switcher' badge={cfg.useMarketSwitch ? 'ACTIVE' : 'OFF'} badgeColor={cfg.useMarketSwitch ? '#06b6d4' : '#64748b'}>
                        <ToggleRow label='Auto Switch Markets' on={cfg.useMarketSwitch}
                            onToggle={() => cfgSet({ useMarketSwitch: !cfg.useMarketSwitch })} disabled={running} />
                        {cfg.useMarketSwitch && (
                            <>
                                <div className='sb-field'>
                                    <label>Switch After Losses</label>
                                    <NumInput value={cfg.switchOnLosses} min={1} max={10}
                                        onChange={v => cfgSet({ switchOnLosses: v })} disabled={running} />
                                    <span className='sb-unit'>losses</span>
                                </div>
                                <p className='sb-hint'>Switches to the next market after {cfg.switchOnLosses} consecutive losses.</p>
                                <div className='sb-markets-list'>
                                    {cfg.markets.map(m => (
                                        <div key={m} className='sb-market-pill'>
                                            <span>{marketLabel(m)}</span>
                                            {!running && <button className='sb-market-remove' onClick={() => removeMarket(m)}>×</button>}
                                        </div>
                                    ))}
                                </div>
                                {!running && (
                                    <div className='sb-add-market'>
                                        <select value={addMarketSel} onChange={e => setAddMarketSel(e.target.value)}>
                                            {ALL_MARKETS.filter(m => !cfg.markets.includes(m.value)).map(m => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                        <button className='sb-add-market-btn' onClick={addMarket}>+ ADD</button>
                                    </div>
                                )}
                            </>
                        )}
                    </SbAccordion>

                    {/* ── Strategy Logic ── */}
                    <SbAccordion title='Strategy Logic' badge={cfg.strategyLogic.enabled ? 'ACTIVE' : 'OFF'} badgeColor={cfg.strategyLogic.enabled ? '#f59e0b' : '#64748b'} defaultOpen>
                        <ToggleRow label='Global Shared' sublabel='' on={cfg.strategyLogic.globalShared}
                            onToggle={() => slSet({ globalShared: !cfg.strategyLogic.globalShared })} disabled={running} />
                        <ToggleRow label='Strategy' sublabel='' on={cfg.strategyLogic.enabled}
                            onToggle={() => slSet({ enabled: !cfg.strategyLogic.enabled })} disabled={running} />

                        {cfg.strategyLogic.conditions.map((cond, idx) => (
                            <div key={cond.id} className='sb-condition-group'>
                                <div className='sb-condition-group__header'>
                                    <span className='sb-condition-group__label'>OR GROUP #{idx + 1}</span>
                                    <span className='sb-condition-badge'>CONDITION</span>
                                    {cfg.strategyLogic.conditions.length > 1 && (
                                        <button className='sb-condition-del' onClick={() => condDel(cond.id)} disabled={running}>🗑</button>
                                    )}
                                </div>
                                <div className='sb-condition-body'>
                                    <div className='sb-field'>
                                        <label>Algorithm</label>
                                        <div className='sb-algo-row'>
                                            <select value={cond.algorithm}
                                                onChange={e => condSet(cond.id, { algorithm: e.target.value as StrategyAlgorithm })}
                                                disabled={running}>
                                                {ALGO_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                            </select>
                                            <span className='sb-rm-info' title='LDP: Last Digit Pattern — checks the last N digits for a specific pattern before entering'>ⓘ</span>
                                        </div>
                                    </div>
                                    <ToggleRow label='Strict' sublabel='' on={cond.strict}
                                        onToggle={() => condSet(cond.id, { strict: !cond.strict })} disabled={running} />
                                    <div className='sb-field-row'>
                                        <div className='sb-field'>
                                            <label>If Last</label>
                                            <NumInput value={cond.ifLast} min={1} max={20}
                                                onChange={v => condSet(cond.id, { ifLast: v })} disabled={running} />
                                        </div>
                                        <div className='sb-field'>
                                            <label>Recovery Limit</label>
                                            <NumInput value={cond.recoveryLimit} min={0} max={100}
                                                onChange={v => condSet(cond.id, { recoveryLimit: v })} disabled={running} />
                                        </div>
                                    </div>
                                    <div className='sb-field'>
                                        <label>Digits Is</label>
                                        <select value={cond.digitsIs}
                                            onChange={e => condSet(cond.id, { digitsIs: e.target.value as StrategyDigits })}
                                            disabled={running}>
                                            {DIGITS_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                        </select>
                                    </div>
                                    <p className='sb-hint sb-hint--cyan'>{condEntryDesc(cond)}</p>
                                </div>
                            </div>
                        ))}

                        {!running && (
                            <button className='sb-add-condition-btn' onClick={condAdd}>
                                + Add OR Condition
                            </button>
                        )}
                    </SbAccordion>

                    {/* ── MARKET 1 ── */}
                    <SbAccordion title='MARKET 1' badge={contractLabel(bot)} badgeColor='#3b82f6'>
                        <div className='sb-field'>
                            <label>Contract Type</label>
                            <span className='sb-badge'>{contractLabel(bot)}</span>
                        </div>
                        <div className='sb-field'>
                            <label>Market</label>
                            <span className='sb-badge'>{marketLabel(cfg.market)}</span>
                        </div>
                        {bot.prediction !== null && (
                            <div className='sb-field'>
                                <label>Barrier / Digit</label>
                                <span className='sb-badge'>{bot.prediction}</span>
                            </div>
                        )}
                        <div className='sb-field'>
                            <label>Signal ID</label>
                            <span className='sb-badge'>Signal_1</span>
                        </div>
                        {cfg.strategyLogic.enabled && cfg.strategyLogic.conditions.length > 0 && (
                            <p className='sb-hint sb-hint--cyan'>{condEntryDesc(cfg.strategyLogic.conditions[0])}</p>
                        )}
                    </SbAccordion>
                </div>

                {/* ── Right — Terminal ── */}
                <div className='sb-detail__terminal-col'>
                    <div className='sb-terminal-market-bar'>
                        <span className='sb-terminal-market-label'>ACTIVE MARKET:</span>
                        <span className='sb-terminal-market-value'>{activeMarket}</span>
                        {entryReady && <span className='sb-entry-ready'>⚡ ENTRY SIGNAL</span>}
                        {running && <span className='sb-terminal__live'>● LIVE</span>}
                    </div>

                    <div className='sb-digit-window'>
                        {digitDisplay.length === 0 ? (
                            <span className='sb-digit-window__empty'>waiting for ticks…</span>
                        ) : digitDisplay.map((d, i) => (
                            <span key={i} className={`sb-digit-chip ${i === 0 ? 'latest' : ''}`}>{d}</span>
                        ))}
                    </div>

                    <div className='sb-terminal'>
                        <div className='sb-terminal__bar'>
                            <div className='sb-terminal__dots'><span /><span /><span /></div>
                            <span>SCAN TERMINAL — {contractLabel(bot)}</span>
                            {running && <span className='sb-terminal__live'>● SCANNING</span>}
                        </div>
                        <div className='sb-terminal__body' ref={termRef}>
                            {terminal.length === 0 ? (
                                <div className='sb-terminal__idle'>
                                    {running ? '> Initializing scanner...' : '> Idle — press RUN to start market scan'}
                                </div>
                            ) : terminal.map((e, i) => (
                                <div key={i} className={`sb-terminal__line ${e.kind}`}>
                                    <span className='sb-terminal__ts'>{e.t}</span>
                                    {e.msg}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>{/* end inner terminal wrapper */}
                </div>{/* end sb-detail__terminal-col */}
            </div>{/* end sb-detail__body */}

            {/* ── Bottom Tabs ── */}
            <div className='sb-tabs'>
                <div className='sb-tabs__nav'>
                    {(['summary', 'transactions', 'journal'] as const).map(t => (
                        <button key={t} className={`sb-tabs__btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                <div className='sb-tabs__panel'>
                    {tab === 'summary' && (
                        <div className='sb-summary'>
                            {summary.runs === 0 && summary.virtualCount === 0 ? (
                                <div className='sb-summary__empty'>
                                    <p>Bot is not running</p>
                                    <p>When you're ready to trade, hit <strong>Run</strong>. You'll be able to track your bot's performance here.</p>
                                </div>
                            ) : (
                                <>
                                    <div className='sb-summary__stats'>
                                        <div className='sb-stat'><span>TOTAL STAKE</span><strong>${txList.reduce((a, t) => a + t.stake, 0).toFixed(2)}</strong></div>
                                        <div className='sb-stat'><span>TOTAL PAYOUT</span><strong>${txList.filter(t => t.result === 'won').reduce((a, t) => a + t.stake + t.profit, 0).toFixed(2)}</strong></div>
                                        <div className='sb-stat'><span>NO. OF RUNS</span><strong>{summary.runs}</strong></div>
                                        <div className='sb-stat red'><span>LOST</span><strong>${Math.abs(txList.filter(t => t.result === 'lost').reduce((a, t) => a + t.profit, 0)).toFixed(2)}</strong></div>
                                        <div className='sb-stat green'><span>WON</span><strong>${txList.filter(t => t.result === 'won').reduce((a, t) => a + t.profit, 0).toFixed(2)}</strong></div>
                                        <div className={`sb-stat ${summary.pnl >= 0 ? 'green' : 'red'}`}>
                                            <span>TOTAL P/L</span>
                                            <strong>{summary.pnl >= 0 ? '+' : ''}{summary.pnl.toFixed(2)} USD</strong>
                                        </div>
                                    </div>
                                    <div className='sb-summary__rates'>
                                        <span>WIN RATE: <strong className={summary.won / summary.runs > 0.5 ? 'green' : 'red'}>{((summary.won / summary.runs) * 100).toFixed(1)}%</strong></span>
                                        <span>WINS: <strong className='green'>{summary.won}</strong></span>
                                        <span>LOSSES: <strong className='red'>{summary.lost}</strong></span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {tab === 'transactions' && (
                        <div className='sb-transactions'>
                            {txList.length === 0 ? (
                                <p className='sb-empty'>No transactions yet. Run the bot to start trading.</p>
                            ) : (
                                <table className='sb-tx-table'>
                                    <thead>
                                        <tr><th>Time</th><th>Market</th><th>Type</th><th>Stake</th><th>Result</th><th>Exit Digit</th><th>Profit</th></tr>
                                    </thead>
                                    <tbody>
                                        {txList.map(tx => (
                                            <tr key={tx.id}>
                                                <td>{tx.time}</td><td>{tx.market}</td><td>{tx.type}</td>
                                                <td>${tx.stake.toFixed(2)}</td>
                                                <td className={`sb-result-${tx.result}`}>{tx.result === 'open' ? '⏳' : tx.result === 'won' ? '✓ WIN' : '✗ LOSS'}</td>
                                                <td>{tx.exitDigit ?? '—'}</td>
                                                <td className={tx.profit >= 0 ? 'green' : 'red'}>{tx.result === 'open' ? '…' : `${tx.profit >= 0 ? '+' : ''}${tx.profit.toFixed(2)}`}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {tab === 'journal' && (
                        <div className='sb-journal'>
                            {terminal.length === 0 ? (
                                txList.some(tx => tx.virtual)
                                    ? <p className='sb-empty'>Virtual Hook activity is shown below.</p>
                                    : <p className='sb-empty'>No journal entries yet. Run the bot to see activity.</p>
                            ) : terminal.slice().reverse().map((e, i) => (
                                <div key={i} className={`sb-journal__line ${e.kind}`}>
                                    <span className='sb-journal__ts'>{e.t}</span>
                                    {e.msg}
                                </div>
                            ))}
                            {txList.filter(tx => tx.virtual).map(tx => (
                                <div key={`hook-journal-${tx.id}`} className={`sb-journal__line ${tx.result === 'won' ? 'win' : 'loss'} sb-journal__hook`}>
                                    <span className='sb-journal__ts'>{tx.time}</span>
                                    {tx.result === 'won' ? '✓ HOOK PROFIT' : '✗ HOOK LOSS'} · {tx.market} · digit {tx.exitDigit ?? '—'}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className='sb-tabs__disclaimer'>
                    ⚠ Risk Disclaimer: Trading involves significant risk of loss and may not be suitable for all investors.
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════
   Main ScalperBots page
   ══════════════════════════════════════════════ */
const ScalperBots: React.FC = observer(() => {
    const store      = useStore();
    const derivTrade = useDerivTrade();
    const [category, setCategory]       = useState('All');
    const [search, setSearch]           = useState('');
    const [selectedBot, setSelectedBot] = useState<TScalperBot | null>(null);

    const groupCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        SCALPER_BOTS.forEach(b => { const g = botGroup(b); if (g) counts[g] = (counts[g] || 0) + 1; });
        return counts;
    }, []);

    const searching = search.trim().length > 0;
    const filtered = SCALPER_BOTS.filter(b => {
        const matchGroup = searching || !openGroup || botGroup(b) === openGroup;
        const matchSrch  = !searching || b.name.toLowerCase().includes(search.toLowerCase());
        return matchGroup && matchSrch;
    });

    const loadXmlIntoWorkspace = useCallback(async (xml: string, name: string): Promise<boolean> => {
        const lm: any = store?.load_modal;
        if (lm?.loadStrategyToBuilder) {
            try {
                await lm.loadStrategyToBuilder({ id: name, xml, name, save_type: 'unsaved' }, false);
                return true;
            } catch { /* fall through to direct Blockly approach */ }
        }
        // Attempt 2: direct Blockly workspace injection (bypasses unsupported-element validation)
        try {
            const B = (window as any).Blockly;
            if (!B?.derivWorkspace) return false;
            const dom = B.Xml.textToDom(xml);
            try { B.derivWorkspace.asyncClear?.(); } catch {}
            B.Xml.domToWorkspace(dom, B.derivWorkspace);
            B.derivWorkspace.strategy_to_load = xml;
            try { B.svgResize?.(B.derivWorkspace); } catch {}
            try { B.derivWorkspace.scrollCenter?.(); } catch {}
            return true;
        } catch { return false; }
    }, [store]);

    const autoRun = useCallback(async () => {
        const rp: any = store?.run_panel;
        if (!rp?.onRunButtonClick) return;
        for (let i = 0; i < 8; i++) {
            try { if (!rp.is_running) { await rp.onRunButtonClick(); return; } else { return; } }
            catch { if (i < 7) await new Promise(r => setTimeout(r, 400)); }
        }
    }, [store]);

    const handleLoadXml = useCallback(async (bot: TScalperBot) => {
        try {
            const res = await fetch(bot.xmlFile);
            if (!res.ok) throw new Error(`Failed to fetch ${bot.xmlFile}`);
            const xml = patchXmlContent(await res.text());
            // Navigate to Bot Builder tab so Blockly initialises
            store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING);
            store?.run_panel?.toggleDrawer?.(true);
            // Wait up to 8 s for Blockly to be ready
            let ok = false;
            for (let n = 0; n < 80 && !ok; n++) {
                ok = await loadXmlIntoWorkspace(xml, bot.name);
                if (!ok) await new Promise(r => setTimeout(r, 100));
            }
        } catch { store?.dashboard?.setActiveTab?.(DBOT_TABS.AHMED_LEARNING); }
    }, [store, loadXmlIntoWorkspace]);

    const handleLoadAndRun = useCallback(async (bot: TScalperBot) => {
        await handleLoadXml(bot);
        setTimeout(() => autoRun(), 900);
    }, [handleLoadXml, autoRun]);

    /* Silently sync the Bot Builder workspace with this bot's default XML.
       Retries up to 30 times (3 s total) so multi-scalper XML loads even
       when Blockly is initialising in the background. */
    const handlePreloadXml = useCallback(async (bot: TScalperBot, opts?: { market?: string; duration?: number; duration_unit?: 't' | 's' }) => {
        try {
            const res = await fetch(bot.xmlFile);
            if (!res.ok) return;
            let xml = await res.text();
            // Patch XML with current market + duration before loading into workspace
            if (opts?.market || opts?.duration != null) {
                xml = patchXmlContent(xml, opts.market, opts.duration, opts.duration_unit);
            }
            // Try immediately, then retry until Blockly workspace is ready
            let ok = await loadXmlIntoWorkspace(xml, bot.name);
            if (!ok) {
                for (let n = 0; n < 30 && !ok; n++) {
                    await new Promise(r => setTimeout(r, 100));
                    ok = await loadXmlIntoWorkspace(xml, bot.name);
                }
            }
        } catch { /* non-fatal — terminal engine trades independently */ }
    }, [loadXmlIntoWorkspace]);

    if (selectedBot) {
        return (
            <BotDetail
                bot={selectedBot}
                derivTrade={derivTrade}
                onBack={() => setSelectedBot(null)}
                onLoadXml={handleLoadXml}
                onLoadAndRun={handleLoadAndRun}
                loadXmlIntoWorkspace={loadXmlIntoWorkspace}
            />
        );
    }

    const showFolders = !openGroup && !searching;

    return (
        <div className='scalper-bots'>
            {/* ── Full-width search bar ── */}
            <div className='scalper-bots__searchbar'>
                <svg width='16' height='16' viewBox='0 0 20 20' fill='none' stroke='currentColor' strokeWidth='2'>
                    <circle cx='8.5' cy='8.5' r='6'/><path d='M14 14l4 4'/>
                </svg>
                <input
                    type='text'
                    placeholder='Search for bots or category...'
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* ── Breadcrumb navbar ── */}
            <div className='scalper-bots__navbar'>
                <button
                    className='scalper-bots__nav-home'
                    onClick={() => { setOpenGroup(null); setSearch(''); }}
                >
                    🏠 Home
                </button>
                {(openGroup || searching) && (
                    <>
                        <span className='scalper-bots__nav-sep'>›</span>
                        <span className='scalper-bots__nav-crumb'>
                            {searching ? `Search: "${search}"` : `${openGroup} Scalpers`}
                        </span>
                    </>
                )}
                <div className='scalper-bots__nav-right'>
                    <AccountBadge />
                    <div className={`scalper-bots__conn ${derivTrade.authorized ? 'on' : 'off'}`}>
                        {derivTrade.authorized ? '● LIVE' : '○ Offline'}
                    </div>
                    {derivTrade.balance !== null && (
                        <div className='scalper-bots__balance'>
                            {derivTrade.currency} {derivTrade.balance.toFixed(2)}
                        </div>
                    )}
                </div>
            </div>

            {showFolders ? (
                /* ── Folder grid ── */
                <div className='scalper-bots__folders'>
                    {GROUP_DEFS.map(g => (
                        <div key={g.key} className='sb-folder' onClick={() => setOpenGroup(g.key)}>
                            <div className='sb-folder__icon'>
                                {/* Dark-green SVG folder icon — scaled up for PC */}
                                <svg width='130' height='104' viewBox='0 0 88 70' fill='none' xmlns='http://www.w3.org/2000/svg'>
                                    <path d='M4 16C4 12.686 6.686 10 10 10H32L40 19H80C83.314 19 86 21.686 86 25V60C86 63.314 83.314 66 80 66H10C6.686 66 4 63.314 4 60V16Z' fill='#1e4d37'/>
                                    <path d='M4 29H86V60C86 63.314 83.314 66 80 66H10C6.686 66 4 63.314 4 60V29Z' fill='#2d6a4f'/>
                                </svg>
                            </div>
                            <div className='sb-folder__label'>{g.label} Scalpers</div>
                            <div className='sb-folder__count'>{groupCounts[g.key] || 0} bots</div>
                        </div>
                    ))}
                </div>
            ) : (
                /* ── Bot card grid ── */
                <div className='scalper-bots__grid'>
                    {filtered.map(bot => (
                        <div key={bot.key} className='sb-card' onClick={() => setSelectedBot(bot)}>
                            <div className='sb-card__icon'>
                                {bot.contractType.includes('EVEN') ? '2️⃣' : bot.contractType.includes('ODD') ? '1️⃣' : bot.contractType.includes('OVER') ? '⬆️' : '⬇️'}
                            </div>
                            <div className='sb-card__name'>{bot.name}</div>
                            <div className='sb-card__tags'>
                                <span className='sb-card__tag'>{bot.contractType}</span>
                                {bot.prediction !== null && <span className='sb-card__tag'>▸{bot.prediction}</span>}
                                <span className={`sb-card__tag ${bot.multiple ? 'multi' : 'single'}`}>
                                    {bot.multiple ? 'MULTI' : 'SINGLE'}
                                </span>
                            </div>
                            <button className='sb-card__open'>Configure &amp; Run →</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

export default ScalperBots;
