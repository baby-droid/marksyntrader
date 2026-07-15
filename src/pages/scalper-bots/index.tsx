// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { applyCommission } from '@/utils/commission';
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

/* Strategy Logic — condition-based entry engine (mirrors the reference "OR Group" UI) */

const DIGITS_IS_OPTIONS = [
    'MATCHES', 'DIFFERS', 'OVER', 'UNDER', 'EVEN', 'ODD',
    'HIGH TICK', 'LOW TICK', 'RISE EQUAL', 'FALL EQUAL',
    'RISE', 'FALL', 'RISE RESET', 'FALL RESET',
    'ASIAN UP', 'ASIAN DOWN', 'ONLY UPS', 'ONLY DOWNS',
    'HIGHER', 'LOWER',
] as const;
type DigitsIsType = typeof DIGITS_IS_OPTIONS[number];

const IF_LAST_OPTIONS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];

/* ── The 6 analysis algorithms available in the OR Group conditions ── */
const ALGORITHM_OPTIONS = ['LDP', 'Market Percentage', 'Sequence Radar', 'Complex Patterns', 'Entry Point Pattern', 'NDP'] as const;
type AlgorithmType = typeof ALGORITHM_OPTIONS[number];

/** A single strategy sub-condition (one row in the UI).
 *  Algorithm-specific fields are all optional with sensible defaults so old
 *  conditions created before new algorithms were added continue to work. */
type StrategyCondition = {
    id: string;
    algorithm: AlgorithmType;
    strict: boolean;           // LDP: all in window must match; others: simple majority
    ifLast: number;            // analysis window size (all algorithms)
    digitsIs: DigitsIsType;    // predicate used by LDP, Market Percentage, Entry Point Pattern
    digitValue: number;        // barrier digit for OVER/UNDER/MATCHES/DIFFERS (0-9)
    recoveryLimit: number;     // relaxed window size after a loss (all algorithms)
    // ── Market Percentage extras ──
    percentageThreshold: number; // 50-100; default 60 — minimum % of window digits that must match
    // ── Sequence Radar extras ──
    sequenceType: 'alternating' | 'increasing' | 'decreasing' | 'zigzag' | 'flat';
    // ── Complex Patterns extras ──
    complexPattern: 'high-low' | 'low-high' | 'ramp-up' | 'ramp-down' | 'spike';
    // ── Entry Point Pattern extras ──
    sensitivity: 'low' | 'medium' | 'high';
};

/** One OR group — all its conditions must pass (AND within the group). */
type StrategyOrGroup = {
    id: string;
    conditions: StrategyCondition[]; // [0]=CONDITION, [1+]=AND CONDITIONS
};

type StrategyLogicConfig = {
    globalShared: boolean;
    active: boolean;
    groups: StrategyOrGroup[]; // any group passing triggers entry (OR across groups)
};

/** Alternate market slot — its own stake/martingale/take-profit/barrier,
    switched to when Market 1 hits its consecutive-loss switch limit. */
type Market2Config = {
    enabled: boolean;
    market: string;
    stake: number;
    martingale: number;
    useStakeOverride: boolean;
    stakeOverride: number;
    takeProfit: number;
    barrier: number;
};

type BotConfig = {
    market: string;
    markets: string[];
    useMarketSwitch: boolean;
    switchOnLosses: number;
    duration: number;
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
    market2: Market2Config;
    multiTradeCount: number; // number of contracts to fire on each entry (multiple bots)
};

const DEFAULT_RM: RiskManagerConfig = {
    inject: false, active: true, onLose: true,
    activateLimit: 1, deactivateLimit: 100,
    multiplier: 2, overrideStake: 20,
};

/* The default condition mirrors checkEntry()'s contrarian logic exactly, so
   turning Strategy Logic on doesn't change default behaviour — it just makes
   the recovery-limit-aware re-entry configurable. Contract type is always
   locked to the bot's own contractType/prediction (never edited here). */
/* Default extra fields shared across all new algorithms */
const COND_DEFAULTS = {
    percentageThreshold: 60,
    sequenceType: 'alternating' as const,
    complexPattern: 'high-low' as const,
    sensitivity: 'medium' as const,
};

let sbCondSeq = 0;
const newCondition = (bot: TScalperBot): StrategyCondition => {
    if (bot.contractType === 'DIGITOVER') {
        return { ...COND_DEFAULTS, id: `cond_${++sbCondSeq}`, algorithm: 'LDP', strict: true, ifLast: 2, digitsIs: 'UNDER', digitValue: bot.prediction ?? 5, recoveryLimit: 1 };
    }
    if (bot.contractType === 'DIGITUNDER') {
        return { ...COND_DEFAULTS, id: `cond_${++sbCondSeq}`, algorithm: 'LDP', strict: true, ifLast: 2, digitsIs: 'OVER', digitValue: bot.prediction ?? 5, recoveryLimit: 1 };
    }
    if (bot.contractType === 'DIGITMATCH') {
        return { ...COND_DEFAULTS, id: `cond_${++sbCondSeq}`, algorithm: 'LDP', strict: true, ifLast: 2, digitsIs: 'DIFFERS', digitValue: bot.prediction ?? 5, recoveryLimit: 1 };
    }
    if (bot.contractType === 'DIGITDIFF') {
        return { ...COND_DEFAULTS, id: `cond_${++sbCondSeq}`, algorithm: 'LDP', strict: true, ifLast: 2, digitsIs: 'MATCHES', digitValue: bot.prediction ?? 5, recoveryLimit: 1 };
    }
    if (bot.contractType === 'CALL') {
        return { ...COND_DEFAULTS, id: `cond_${++sbCondSeq}`, algorithm: 'LDP', strict: true, ifLast: 3, digitsIs: 'ONLY DOWNS', digitValue: 5, recoveryLimit: 1 };
    }
    if (bot.contractType === 'PUT') {
        return { ...COND_DEFAULTS, id: `cond_${++sbCondSeq}`, algorithm: 'LDP', strict: true, ifLast: 3, digitsIs: 'ONLY UPS', digitValue: 5, recoveryLimit: 1 };
    }
    return {
        ...COND_DEFAULTS,
        id: `cond_${++sbCondSeq}`,
        algorithm: 'LDP',
        strict: true,
        ifLast: 3,
        digitsIs: bot.contractType === 'DIGITEVEN' ? 'ODD' : 'EVEN',
        digitValue: 5,
        recoveryLimit: 1,
    };
};

let sbGroupSeq = 0;
const newOrGroup = (bot: TScalperBot): StrategyOrGroup => ({
    id: `grp_${++sbGroupSeq}`,
    conditions: [newCondition(bot)],
});

const DEFAULT_CONFIG = (bot: TScalperBot): BotConfig => ({
    market: '1HZ10V',
    markets: ['1HZ50V', '1HZ100V', '1HZ75V'],
    useMarketSwitch: false,
    switchOnLosses: 2,
    duration: 1,
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
    strategyLogic: {
        globalShared: false,
        active: true,
        groups: [newOrGroup(bot)],
    },
    market2: {
        enabled: false,
        market: '1HZ25V',
        stake: 0.35,
        martingale: 2,
        useStakeOverride: false,
        stakeOverride: 20,
        takeProfit: 100,
        barrier: bot.prediction ?? 5,
    },
    multiTradeCount: bot.multiple ? 3 : 1,
});

const ALL_MARKETS = [
    { label: 'V10 (1s)',  value: '1HZ10V'  },
    { label: 'V25 (1s)',  value: '1HZ25V'  },
    { label: 'V50 (1s)',  value: '1HZ50V'  },
    { label: 'V75 (1s)',  value: '1HZ75V'  },
    { label: 'V100 (1s)', value: '1HZ100V' },
    { label: 'V10',       value: 'R_10'    },
    { label: 'V25',       value: 'R_25'    },
    { label: 'V50',       value: 'R_50'    },
    { label: 'V75',       value: 'R_75'    },
    { label: 'V100',      value: 'R_100'   },
    { label: 'Jump 10',   value: 'JD10'    },
    { label: 'Jump 25',   value: 'JD25'    },
    { label: 'Jump 50',   value: 'JD50'    },
    { label: 'Jump 75',   value: 'JD75'    },
    { label: 'Jump 100',  value: 'JD100'   },
];

const SCALPER_BOTS: TScalperBot[] = manifest as TScalperBot[];

/* Individual folder groups — Over and Under (and Matches/Differs, Rise/Fall,
   Even/Odd) are split into their OWN folder icon rather than sharing a
   combined category, so pressing "Over" shows only Over scalpers, etc. */
type SbGroup = 'Over' | 'Under' | 'Rise' | 'Fall' | 'Matches' | 'Differs' | 'Even' | 'Odd';
const GROUP_DEFS: { key: SbGroup; label: string; icon: string }[] = [
    { key: 'Over',    label: 'Over',    icon: '⬆️' },
    { key: 'Under',   label: 'Under',   icon: '⬇️' },
    { key: 'Rise',    label: 'Rise',    icon: '📈' },
    { key: 'Fall',    label: 'Fall',    icon: '📉' },
    { key: 'Matches', label: 'Matches', icon: '🎯' },
    { key: 'Differs', label: 'Differs', icon: '🚫' },
    { key: 'Even',    label: 'Even',    icon: '2️⃣' },
    { key: 'Odd',     label: 'Odd',     icon: '1️⃣' },
];
function botGroup(bot: TScalperBot): SbGroup | null {
    switch (bot.contractType) {
        case 'DIGITOVER':  return 'Over';
        case 'DIGITUNDER': return 'Under';
        case 'CALL':        return 'Rise';
        case 'PUT':         return 'Fall';
        case 'DIGITMATCH':  return 'Matches';
        case 'DIGITDIFF':   return 'Differs';
        case 'DIGITEVEN':   return 'Even';
        case 'DIGITODD':    return 'Odd';
        default: return null;
    }
}

/* ─── Hacker scan messages (shown during market analysis) ─── */
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
];

/* ─── Entry signal detection ─── */
function checkEntry(
    digits: number[],
    contractType: string,
    barrier: number | null,
    prices?: number[],  // raw price window (newest first) — used for Rise/Fall
): boolean {
    if (digits.length < 5) return false;
    const recent = digits.slice(0, 10);

    switch (contractType) {
        case 'DIGITEVEN': {
            // contrarian: ≥3 consecutive ODD → bet EVEN
            let streak = 0;
            for (const d of recent) { if (d % 2 !== 0) streak++; else break; }
            return streak >= 3;
        }
        case 'DIGITODD': {
            // contrarian: ≥3 consecutive EVEN → bet ODD
            let streak = 0;
            for (const d of recent) { if (d % 2 === 0) streak++; else break; }
            return streak >= 3;
        }
        case 'DIGITOVER': {
            if (barrier === null) return true;
            // reversal: ≥2 consecutive digits ≤ barrier → bet OVER
            let streak = 0;
            for (const d of recent) { if (d <= barrier) streak++; else break; }
            return streak >= 2;
        }
        case 'DIGITUNDER': {
            if (barrier === null) return true;
            // reversal: ≥2 consecutive digits > barrier → bet UNDER
            let streak = 0;
            for (const d of recent) { if (d > barrier) streak++; else break; }
            return streak >= 2;
        }
        case 'CALL': {
            /* Rise scalper — contrarian: bet RISE after ≥3 consecutive falling prices
               (reversal entry). Uses raw price window when available, falls back to
               digit momentum check (digit increasing means price rose). */
            if (prices && prices.length >= 4) {
                // prices[0]=newest, prices[1]=previous; price is falling if newest < previous
                let down = 0;
                for (let i = 0; i < prices.length - 1; i++) {
                    if (prices[i] < prices[i + 1]) down++; else break;
                }
                return down >= 3;
            }
            // Digit fallback: ≥3 consecutive digits falling (price proxy)
            let dStreak = 0;
            for (let i = 0; i < recent.length - 1; i++) {
                if (recent[i] <= recent[i + 1]) dStreak++; else break;
            }
            return dStreak >= 3;
        }
        case 'PUT': {
            /* Fall scalper — contrarian: bet FALL after ≥3 consecutive rising prices */
            if (prices && prices.length >= 4) {
                let up = 0;
                for (let i = 0; i < prices.length - 1; i++) {
                    if (prices[i] > prices[i + 1]) up++; else break;
                }
                return up >= 3;
            }
            let dStreak = 0;
            for (let i = 0; i < recent.length - 1; i++) {
                if (recent[i] >= recent[i + 1]) dStreak++; else break;
            }
            return dStreak >= 3;
        }
        case 'DIGITMATCH': {
            if (barrier === null) return digits.length >= 5;
            /* Delayed Exhaustion: digit absent ≥8 consecutive ticks → expect it next */
            let absent = 0;
            for (const d of recent.concat(digits.slice(10, 30))) { if (d !== barrier) absent++; else break; }
            if (absent >= 8) return true;
            /* Double echo: same target digit appeared twice in a row → momentum repeat */
            if (recent.length >= 3 && recent[0] === barrier && recent[1] === barrier) return true;
            /* High-frequency skew: target digit <6% in last 50 ticks → overdue */
            const total = digits.length;
            const matchCount = digits.filter(d => d === barrier).length;
            if (total >= 20 && matchCount / total < 0.06) return true;
            return false;
        }
        case 'DIGITDIFF': {
            if (barrier === null) return true;
            // reversal: barrier appeared ≥3 times in last 10 → overdue for another
            const cnt = recent.filter(d => d === barrier).length;
            return cnt >= 3;
        }
        default:
            return digits.length >= 3; // fallback: just need some data
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
        case 'LDP':
        case 'NDP':
        default: {
            if (cond.strict) {
                let prev: number | null = null;
                for (const d of recent) { if (!matchFn(d, prev)) return false; prev = d; }
                return true;
            } else {
                let count = 0, prev: number | null = null;
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
            const digitStr = window.length ? `[${window.join(',')}]` : '[…]';
            const modeNote = inRecovery
                ? ` ← recovery limit (${cond.recoveryLimit} digit${cond.recoveryLimit > 1 ? 's' : ''})`
                : ` (${cond.ifLast} digits)`;
            return `${tag} last ${reqCount} digit${reqCount > 1 ? 's' : ''} are ${cond.digitsIs}${modeNote}: ${digitStr}`;
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
            const digitStr = window.length ? `[${window.join(',')}]` : '[…]';
            const modeNote = inRecovery
                ? ` ← recovery limit (${cond.recoveryLimit} digit${cond.recoveryLimit > 1 ? 's' : ''})`
                : ` (${cond.ifLast} digits)`;
            return `${tag} NDP: next ${reqCount} digit${reqCount > 1 ? 's' : ''} are ${cond.digitsIs}${modeNote}: ${digitStr}`;
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
        .reduce((sum, c) => sum + Math.max(1, inRecovery ? (c.recoveryLimit ?? 1) : c.ifLast), 0);
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

/* ─── Patch XML string with correct market / duration before loading ─── */
function patchXmlContent(xml: string, market?: string, duration?: number): string {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        if (market) {
            const marketBlock = doc.querySelector('block[type="trade_definition_market"]');
            if (marketBlock) {
                const symbolField = marketBlock.querySelector('field[name="SYMBOL_LIST"]');
                if (symbolField) symbolField.textContent = market;
                const subField = marketBlock.querySelector('field[name="SUBMARKET_LIST"]');
                if (subField) subField.textContent = market.startsWith('JD') ? 'jump_index' : 'random_index';
            }
        }
        if (duration != null) {
            const tradeopts = doc.querySelector('block[type="trade_definition_tradeoptions"]');
            if (tradeopts) {
                const durValue = tradeopts.querySelector('value[name="DURATION"]');
                if (durValue) {
                    const numField = durValue.querySelector('field[name="NUM"]');
                    if (numField) numField.textContent = String(duration);
                }
            }
        }
        return new XMLSerializer().serializeToString(doc);
    } catch {
        return xml; // fallback: return original XML unchanged
    }
}

function getLastDigit(q: number): number {
    const s = q.toFixed(2).replace('.', '');
    return parseInt(s[s.length - 1], 10);
}

function contractLabel(bot: TScalperBot): string {
    if (bot.contractType === 'DIGITEVEN')  return 'EVEN';
    if (bot.contractType === 'DIGITODD')   return 'ODD';
    if (bot.contractType === 'DIGITOVER')  return `OVER ${bot.prediction}`;
    if (bot.contractType === 'DIGITUNDER') return `UNDER ${bot.prediction}`;
    return bot.contractType;
}

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

/* ─── Number Field ───
   Keeps its own text buffer so the user can freely clear/retype a value —
   only clamps/commits the numeric value on blur or Enter, never mid-keystroke. */
const NumberField: React.FC<{
    value: number;
    onCommit: (n: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    className?: string;
}> = ({ value, onCommit, min, max, disabled, className }) => {
    const [text, setText] = useState(String(value));
    const focusedRef = useRef(false);

    useEffect(() => {
        if (!focusedRef.current) setText(String(value));
    }, [value]);

    const commit = () => {
        focusedRef.current = false;
        let n = parseFloat(text);
        if (Number.isNaN(n)) n = value;
        if (min != null) n = Math.max(min, n);
        if (max != null) n = Math.min(max, n);
        setText(String(n));
        if (n !== value) onCommit(n);
    };

    return (
        <input
            type='text'
            inputMode='decimal'
            className={`sb-num-input ${className || ''}`}
            disabled={disabled}
            value={text}
            onFocus={() => { focusedRef.current = true; }}
            onChange={e => {
                const v = e.target.value;
                if (v === '' || /^-?\d*\.?\d*$/.test(v)) setText(v);
            }}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
    );
};

/* ─── Accordion Section ─── */
const SbAccordion: React.FC<{ title: string; badge?: string; badgeColor?: string; defaultOpen?: boolean; children: React.ReactNode }> = ({
    title, badge, badgeColor = '#22c55e', defaultOpen = false, children,
}) => {
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
   BotDetail — full configure + run view
   ══════════════════════════════════════════════ */
const BotDetail: React.FC<{
    bot: TScalperBot;
    derivTrade: ReturnType<typeof useDerivTrade>;
    onBack: () => void;
    onLoadXml: (bot: TScalperBot) => Promise<void>;
    onLoadAndRun: (bot: TScalperBot) => Promise<void>;
    onPreloadXml: (bot: TScalperBot, opts?: { market?: string; duration?: number }) => Promise<void>;
}> = ({ bot, derivTrade, onBack, onLoadXml, onLoadAndRun, onPreloadXml }) => {
    const store = useStore();

    /* ── Fast Execution toggle ── skip condition scan, fire immediately on first tick */
    const [fastExec, setFastExec] = useState(false);
    const fastExecRef = useRef(false);
    useEffect(() => { fastExecRef.current = fastExec; }, [fastExec]);

    /* Patch the already-loaded Blockly workspace's market/stake/martingale-size/
       prediction fields WITHOUT reloading the XML from disk — this keeps the
       real Bot Builder bot in lock-step with the terminal's current run
       parameters right before it is triggered to buy. Contract type itself is
       never touched here — it stays locked to this bot's own strategy. */
    const patchWorkspaceParams = useCallback((patch: {
        market?: string; stake?: number; martingale?: number; prediction?: number | null; duration?: number;
    }): boolean => {
        try {
            const B = (window as any).Blockly;
            if (!B?.derivWorkspace) return false;
            const blocks = B.derivWorkspace.getAllBlocks(false);
            let changed = false;
            for (const block of blocks) {
                if (patch.market && block.type === 'trade_definition_market') {
                    try {
                        block.getField('SUBMARKET_LIST')?.setValue(patch.market.startsWith('JD') ? 'jump_index' : 'random_index');
                        block.getField('SYMBOL_LIST')?.setValue(patch.market);
                        changed = true;
                    } catch { /* noop */ }
                }
                if (block.type === 'variables_set') {
                    const varName = block.getField('VAR')?.getText?.();
                    if (patch.stake != null && varName === 'stake') {
                        const child = block.getInputTargetBlock?.('VALUE');
                        if (child?.type === 'math_number') { child.getField('NUM')?.setValue(String(patch.stake)); changed = true; }
                    }
                    if (patch.martingale != null && varName === 'martingale size') {
                        const child = block.getInputTargetBlock?.('VALUE');
                        if (child?.type === 'math_number') { child.getField('NUM')?.setValue(String(patch.martingale)); changed = true; }
                    }
                }
                if (patch.prediction != null && block.type === 'trade_definition_tradeoptions') {
                    const child = block.getInputTargetBlock?.('PREDICTION');
                    if (child) { child.getField('NUM')?.setValue(String(patch.prediction)); changed = true; }
                }
                if (patch.duration != null && block.type === 'trade_definition_tradeoptions') {
                    try {
                        block.getField('DURATIONTYPE_LIST')?.setValue('t');
                        const durInput = block.getInput?.('DURATION');
                        const durBlock = durInput?.connection?.targetBlock?.();
                        if (durBlock) { durBlock.getField('NUM')?.setValue(String(patch.duration)); changed = true; }
                    } catch { /* noop */ }
                }
            }
            return changed;
        } catch { return false; }
    }, []);

    /* Backwards-compatible alias used by the "📂 Builder" load-and-run button. */
    const setWorkspaceMarket = useCallback((market: string): boolean => patchWorkspaceParams({ market }), [patchWorkspaceParams]);

    /* autoRun — patches the market in the workspace, then clicks the real Run
       button. Retries until the Blockly workspace exists (up to 4 s). */
    const autoRun = useCallback(async (market?: string) => {
        if (market) {
            let ok = setWorkspaceMarket(market);
            for (let n = 0; n < 40 && !ok; n++) {
                await new Promise(r => setTimeout(r, 100));
                ok = setWorkspaceMarket(market);
            }
        }
        const rp: any = store?.run_panel;
        if (!rp?.onRunButtonClick) return;
        for (let i = 0; i < 8; i++) {
            try {
                if (!rp.is_running) { await rp.onRunButtonClick(); return; }
                else { return; } // already running
            } catch { if (i < 7) await new Promise(r => setTimeout(r, 400)); }
        }
    }, [store, setWorkspaceMarket]);

    /* Trigger the real Bot Builder Run button with zero artificial delay and
       await this run cycle's outcome. The XML bot's own before_purchase /
       after_purchase / trade_again blocks own the actual buy + martingale —
       this only (a) syncs market/stake/martingale/prediction into the
       workspace right before firing, (b) listens to every settled contract
       via globalObserver('bot.contract') so the terminal log stays accurate,
       and (c) force-stops the XML bot the moment a terminal-level guard
       (take profit / stop loss / consecutive-loss limit) is breached — those
       guards do not exist inside the XML itself. Resolves once the bot cycle
       ends (naturally on a win, or via our forced stop). */
    const runXmlBotCycle = useCallback((params: {
        market: string; stake: number; martingale: number; prediction: number | null;
        consecutiveLossLimit: number; stopOnLoss: boolean; tpGuard: boolean;
        takeProfit: number; stopLoss: number; sessionPnlRef: { current: number };
        /* Consecutive-loss count carried in from the outer scan loop BEFORE this
           cycle's trade. Each cycle only ever settles ONE contract (the bot is
           force-stopped on every loss — see onContract below), so seeding from
           this value is what lets the martingale/consecutive-loss chain survive
           across cycles, market switches, and market-2 fallbacks instead of
           resetting to 0/1 every single trade. */
        priorConsLoss?: number;
        onSettled: (info: { profit: number; won: boolean; market: string; buyPrice: number; exitDigit: number | null; consLoss: number }) => void;
        onLog: (msg: string, kind?: string) => void;
    }): Promise<{ forceStopped: boolean; reason: 'tp' | 'sl' | 'loss_limit' | null; cycleProfit: number; consLoss: number; lastWon: boolean }> => {
        return new Promise(resolve => { (async () => {
            const rp: any = store?.run_panel;
            if (!rp?.onRunButtonClick) { resolve({ forceStopped: false, reason: null, cycleProfit: 0, consLoss: params.priorConsLoss || 0, lastWon: true }); return; }

            /* ── Wait out any in-flight teardown from the PREVIOUS forced stop ──
               globalObserver emits 'bot.stop' from inside terminateSession()
               *before* it finishes unsubscribing/tearing down, and dbot.js only
               recreates a fresh interpreter (`this.interpreter = Interpreter()`)
               after that teardown promise resolves. Our previous cycle resolves
               on that early 'bot.stop' event, so firing the next run immediately
               could race dbot.js's own stopBot() — runBot() no-ops while
               api_base.is_stopping is still true, or reuses a not-yet-reset
               interpreter, and the freshly patched stake/martingale values never
               reach the actual trade (symptom: stake stays flat after a loss
               instead of escalating). Poll briefly until teardown settles. */
            const teardownStart = Date.now();
            while (api_base.is_stopping && Date.now() - teardownStart < 3000) {
                await new Promise(r => setTimeout(r, 25));
            }

            patchWorkspaceParams({
                market: params.market, stake: params.stake,
                martingale: params.martingale, prediction: params.prediction,
            });

            const seen = new Set<number | string>();
            let cycleProfit = 0;
            let consLoss = params.priorConsLoss || 0;
            let lastWon = true;   // updated on every settled contract; false = last trade was a loss
            let forceStopped = false;
            let reason: 'tp' | 'sl' | 'loss_limit' | null = null;
            let settled = false;
            let stallTimer: ReturnType<typeof setTimeout> | null = null;

            const cleanup = () => {
                if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
                try { globalObserver.unregister('bot.contract', onContract); } catch {}
                try { globalObserver.unregister('bot.stop', onStop); } catch {}
                try { globalObserver.unregister('Error', onError); } catch {}
            };
            const finish = () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve({ forceStopped, reason, cycleProfit, consLoss, lastWon });
            };
            const onContract = (contract: any) => {
                if (!contract || !isEnded(contract)) return;
                const cid = contract.contract_id ?? contract.transaction_ids?.buy ?? contract.transaction_id;
                if (cid != null) { if (seen.has(cid)) return; seen.add(cid); }
                const profit = applyCommission(Number(contract.profit) || 0);
                const won = profit > 0;
                const exitDigit = contract.exit_tick != null ? getLastDigit(Number(contract.exit_tick)) : null;
                cycleProfit = +(cycleProfit + profit).toFixed(2);
                params.sessionPnlRef.current = +(params.sessionPnlRef.current + profit).toFixed(2);
                consLoss = won ? 0 : consLoss + 1;
                lastWon = won; // track result of most recent trade so outer loop knows win vs loss

                params.onSettled({ profit, won, market: params.market, buyPrice: Number(contract.buy_price) || params.stake, exitDigit, consLoss });

                const tpHit = params.tpGuard && params.sessionPnlRef.current >= params.takeProfit;
                const slHit = params.tpGuard && params.sessionPnlRef.current <= -Math.abs(params.stopLoss);
                const lossLimitHit = params.stopOnLoss && consLoss >= params.consecutiveLossLimit;

                if (!won) {
                    /* Always stop the XML bot after every single loss — the terminal owns the
                       full martingale + market-switch recovery loop. The XML's trade_again
                       block must NOT run on loss; each new scan cycle is a fresh controlled entry. */
                    if (tpHit || slHit || lossLimitHit) {
                        forceStopped = true;
                        reason = tpHit ? 'tp' : slHit ? 'sl' : 'loss_limit';
                    }
                    try { rp.onStopButtonClick?.(); } catch {}
                } else if (won && (tpHit || slHit)) {
                    // Win pushed over TP/SL boundary — stop before bot.stop fires naturally.
                    forceStopped = true;
                    reason = tpHit ? 'tp' : 'sl';
                    try { rp.onStopButtonClick?.(); } catch {}
                }
                // Win without guard: XML stops naturally → bot.stop → onStop → finish()
            };
            const onStop = () => finish();
            const onError = (err: any) => {
                params.onLog(`⚠ ${err?.message || err?.error?.message || 'Bot engine error — stopping cycle.'}`, 'error');
                finish();
            };

            globalObserver.register('bot.contract', onContract);
            globalObserver.register('bot.stop', onStop);
            globalObserver.register('Error', onError);

            Promise.resolve(rp.onRunButtonClick()).catch(err => onError(err));

            /* Stall guard — if neither bot.contract nor bot.stop fires within 45 s the
               trade is hung (network issue, Blockly not ready, etc.). Force-resolve so
               the scan loop is not frozen permanently. */
            stallTimer = setTimeout(() => {
                params.onLog('⚠ TRADE_STALL — no trade response in 45 s, aborting cycle.', 'error');
                try { rp.onStopButtonClick?.(); } catch {}
                setTimeout(finish, 1500); // give bot.stop one last chance to fire cleanly
            }, 45_000);
        })(); });
    }, [store, patchWorkspaceParams]);

    const [cfg, setCfg]         = useState<BotConfig>(() => DEFAULT_CONFIG(bot));
    const [running, setRunning] = useState(false);
    const [scanning, setScanning] = useState(false); // terminal scanning without trading
    const [tab, setTab]         = useState<'summary' | 'transactions' | 'journal'>('summary');
    const [terminal, setTerminal] = useState<{ t: string; msg: string; kind: string }[]>([]);
    const [txList, setTxList]   = useState<TxRecord[]>([]);
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    const [loadingXml, setLoadingXml] = useState(false);
    const [entryReady, setEntryReady] = useState(false); // lights up when entry signal detected
    const [activeMarket, setActiveMarket] = useState(cfg.market);
    const [addMarketSel, setAddMarketSel] = useState('1HZ50V');
    const [digitDisplay, setDigitDisplay] = useState<number[]>([]); // reactive copy for rendering
    const [winPopup, setWinPopup] = useState<{
        profit: number; stopped: boolean;
        sessionPnl: number; wins: number; losses: number; reason?: string;
    } | null>(null);

    /* ── VPS Mode state ── */
    const [vpsEnabled, setVpsEnabled]     = useState(false);
    const [vpsSettings, setVpsSettings]   = useState<VpsSettings>({ numRuns: 0, takeProfit: 0, stopLoss: 0 });
    const [vpsRuns, setVpsRuns]           = useState(0);
    const [vpsPnl, setVpsPnl]             = useState(0);
    const [vpsDonePopup, setVpsDonePopup] = useState<{ reason: string; pnl: number; runs: number } | null>(null);

    const stopRef         = useRef(false);
    const consLossRef     = useRef(0);
    const sessionPnlRef   = useRef(0);
    const txIdRef         = useRef(0);
    const termRef         = useRef<HTMLDivElement>(null);
    const digitWindowRef  = useRef<number[]>([]);
    const priceWindowRef  = useRef<number[]>([]); // raw prices (newest first) for Rise/Fall
    const tickUnsubRef    = useRef<(() => void) | null>(null);
    const marketIdxRef    = useRef(0);
    const lastFiredGroupRef = useRef<StrategyOrGroup | null>(null);
    const [ldpInfoOpen, setLdpInfoOpen] = useState<string | null>(null); // which group's info popup is open
    const multiWindowsRef = useRef<Map<string, number[]>>(new Map());
    const multiUnsubsRef  = useRef<Map<string, () => void>>(new Map());
    const readyMarketRef  = useRef<string | null>(null);
    /* Supersonic scanning — the tick subscriber calls this to wake the scan
       loop immediately on every new tick instead of polling on a fixed timer. */
    const tickSignalRef   = useRef<(() => void) | null>(null);
    /* Per-session counters (refs so they stay accurate inside async callbacks) */
    const winsRef         = useRef(0);
    const lossesRef       = useRef(0);
    /* ── Live-feed health & run-lifecycle tracking ──
       lastTickAtRef: timestamp of the most recent tick from ANY subscribed
       market — the watchdog below force-reconnects the feed if it goes stale.
       curMarketRef/marketListRef/multiScanRef mirror startBot's local
       variables so the watchdog (a separate effect) can resubscribe the right
       market(s) without needing them threaded through props.
       firstTradeRef: the very first trade of a fresh run waits for full
       workspace/feed readiness (normal speed) — every trade after that stays
       supersonic (tick-driven, zero artificial delay). */
    const lastTickAtRef       = useRef(Date.now());
    const lastReconnectAtRef  = useRef(0); // cooldown: don't reconnect more than once per 30 s
    const curMarketRef    = useRef(cfg.market);
    const marketListRef   = useRef<string[]>([cfg.market]);
    const multiScanRef    = useRef(false);
    const firstTradeRef   = useRef(true);
    const prevConnectedRef = useRef(true);

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);
    useEffect(() => { setActiveMarket(cfg.market); }, [cfg.market]);

    const summary = useMemo(() => {
        const won  = txList.filter(t => t.result === 'won').length;
        const lost = txList.filter(t => t.result === 'lost').length;
        const pnl  = txList.reduce((a, t) => a + t.profit, 0);
        return { runs: txList.length, won, lost, pnl };
    }, [txList]);

    const ts = () => new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const addLog = useCallback((msg: string, kind = 'info') => {
        setTerminal(prev => [{ t: ts(), msg, kind }, ...prev].slice(0, 300));
    }, []);

    useEffect(() => {
        if (termRef.current) termRef.current.scrollTop = 0;
    }, [terminal.length]);

    const cfgSet = (patch: Partial<BotConfig>) => setCfg(prev => ({ ...prev, ...patch }));
    const rmSet  = (patch: Partial<RiskManagerConfig>) =>
        setCfg(prev => ({ ...prev, riskManager: { ...prev.riskManager, ...patch } }));
    const slSet  = (patch: Partial<StrategyLogicConfig>) =>
        setCfg(prev => ({ ...prev, strategyLogic: { ...prev.strategyLogic, ...patch } }));
    /* Patch a specific condition within an OR group */
    const conditionSet = (groupId: string, condId: string, patch: Partial<StrategyCondition>) =>
        setCfg(prev => ({
            ...prev,
            strategyLogic: {
                ...prev.strategyLogic,
                groups: prev.strategyLogic.groups.map(g =>
                    g.id === groupId
                        ? { ...g, conditions: g.conditions.map(c => c.id === condId ? { ...c, ...patch } : c) }
                        : g
                ),
            },
        }));
    /* Add an AND condition to an OR group */
    const addCondition = (groupId: string) =>
        setCfg(prev => ({
            ...prev,
            strategyLogic: {
                ...prev.strategyLogic,
                groups: prev.strategyLogic.groups.map(g =>
                    g.id === groupId ? { ...g, conditions: [...g.conditions, newCondition(bot)] } : g
                ),
            },
        }));
    /* Remove an AND condition from an OR group */
    const removeCondition = (groupId: string, condId: string) =>
        setCfg(prev => ({
            ...prev,
            strategyLogic: {
                ...prev.strategyLogic,
                groups: prev.strategyLogic.groups.map(g =>
                    g.id === groupId ? { ...g, conditions: g.conditions.filter(c => c.id !== condId) } : g
                ),
            },
        }));
    const addGroup = () => setCfg(prev => ({
        ...prev,
        strategyLogic: { ...prev.strategyLogic, groups: [...prev.strategyLogic.groups, newOrGroup(bot)] },
    }));
    const removeGroup = (id: string) => setCfg(prev => ({
        ...prev,
        strategyLogic: { ...prev.strategyLogic, groups: prev.strategyLogic.groups.filter(g => g.id !== id) },
    }));
    const m2Set = (patch: Partial<Market2Config>) =>
        setCfg(prev => ({ ...prev, market2: { ...prev.market2, ...patch } }));

    /* ── Subscribe to ticks for the active market ──
       Each new tick immediately wakes the scan loop (tickSignalRef) so the
       condition check runs at true tick-rate with no poll delay. */
    const subscribeMarket = useCallback((market: string) => {
        if (tickUnsubRef.current) { tickUnsubRef.current(); tickUnsubRef.current = null; }
        digitWindowRef.current = [];
        priceWindowRef.current = [];
        setDigitDisplay([]);
        const unsub = derivTrade.subscribeTicks(market, tick => {
            const d = tick.digit != null ? tick.digit : getLastDigit(tick.quote);
            digitWindowRef.current = [d, ...digitWindowRef.current].slice(0, 50);
            // Also track raw prices for Rise/Fall momentum detection
            if (tick.quote != null) {
                priceWindowRef.current = [Number(tick.quote), ...priceWindowRef.current].slice(0, 50);
            }
            setDigitDisplay(prev => [d, ...prev].slice(0, 20));
            // ✅ Reset stall timer on every real tick — prevents false-fire watchdog
            lastTickAtRef.current = Date.now();
            // ⚡ Wake the scan loop instantly on every new tick
            if (tickSignalRef.current) { tickSignalRef.current(); tickSignalRef.current = null; }
        });
        tickUnsubRef.current = unsub;
        setActiveMarket(market);
    }, [derivTrade]);

    /* Cleanup on unmount */
    useEffect(() => () => {
        if (tickUnsubRef.current) tickUnsubRef.current();
        multiUnsubsRef.current.forEach(u => u());
        multiUnsubsRef.current.clear();
    }, []);

    /* ── Parallel multi-market scanning: subscribe every configured market at once and
         flag the first one whose Strategy Logic condition fires ── */
    const subscribeAllMarkets = useCallback((markets: string[]) => {
        markets.forEach(market => {
            if (multiUnsubsRef.current.has(market)) return;
            multiWindowsRef.current.set(market, []);
            const unsub = derivTrade.subscribeTicks(market, tick => {
                const d = tick.digit != null ? tick.digit : getLastDigit(tick.quote);
                const win = [d, ...(multiWindowsRef.current.get(market) || [])].slice(0, 50);
                multiWindowsRef.current.set(market, win);
                if (!readyMarketRef.current) {
                    const r = evaluateStrategyLogic(win, cfg.strategyLogic.groups, false, { prices: [], contractType: bot.contractType, prediction: bot.prediction });
                    if (r.hit) {
                        readyMarketRef.current = market;
                        lastFiredGroupRef.current = r.group ?? null;
                    }
                }
            });
            multiUnsubsRef.current.set(market, unsub);
        });
    }, [derivTrade, cfg.strategyLogic.groups]);

    const unsubscribeAllMarkets = useCallback(() => {
        multiUnsubsRef.current.forEach(u => u());
        multiUnsubsRef.current.clear();
        multiWindowsRef.current.clear();
        readyMarketRef.current = null;
    }, []);

    /* ── Hacker startup sequence ── */
    const runHackerStartup = async (market: string, multiMarket: boolean) => {
        const msgs = [
            `STATUS: ONLINE TURBO`,
            `CONNECTION_SPEED: ${118 + Math.floor(Math.random() * 32)} Mbps`,
            'INJECTING_RECOVERY_PROTOCOL...',
            'BYPASSING FIREWALL...',
            'BUFFER_OVERFLOW_CHECK: PASS',
            `MULTIPLE_MARKET_SYNC: ${multiMarket ? 'ENABLED' : 'DISABLED'}`,
            `SECURE_TUNNEL: ESTABLISHED → ${market}`,
            'DDOS_PROTECTION: BYPASSED',
            'ENCRYPTING RSA_2048_KEYS',
            `SIGNAL_PROCESSOR: ONLINE — ${contractLabel(bot)}`,
            'MARKET_FEED_INTEGRITY: OK',
        ];
        for (const m of msgs) {
            if (stopRef.current) return;
            addLog(m, 'hack');
            await new Promise(r => setTimeout(r, 90 + Math.random() * 70));
        }
    };

    /* ── Start bot (with real tick entry detection) ── */
    const startBot = useCallback(async () => {
        if (running || !derivTrade.authorized) return;
        stopRef.current    = false;
        consLossRef.current = 0;
        sessionPnlRef.current = 0;
        marketIdxRef.current  = 0;
        winsRef.current   = 0;
        lossesRef.current = 0;
        firstTradeRef.current = true;
        lastFiredGroupRef.current = null;
        tickSignalRef.current = null;
        setRunning(true);
        setEntryReady(false);
        setTerminal([]);
        setWinPopup(null);

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

        /* Market 2 support — 'm1' uses cfg.stake/martingale/takeProfit/bot.prediction;
           'm2' swaps in cfg.market2's own stake/martingale/takeProfit/barrier while
           keeping the SAME locked contract type. Only engages when cfg.market2.enabled
           and the market-switch loss limit is hit (see loss branch below). */
        let activeSlot: 'm1' | 'm2' = 'm1';
        const slotBarrier = () => (activeSlot === 'm2' ? cfg.market2.barrier : bot.prediction);
        const slotTakeProfit = () => (activeSlot === 'm2' ? cfg.market2.takeProfit : cfg.takeProfit);
        const slotMartingale = () => (activeSlot === 'm2' ? cfg.market2.martingale : cfg.martingale);
        const slotBaseStake = () => (activeSlot === 'm2' ? cfg.market2.stake : cfg.stake);
        const slotUseStakeOverride = () => (activeSlot === 'm2' ? cfg.market2.useStakeOverride : cfg.useStakeOverride);
        const slotStakeOverride = () => (activeSlot === 'm2' ? cfg.market2.stakeOverride : cfg.stakeOverride);

        /* Compute the correct stake for the next trade given accumulated consecutive losses.
           Risk Manager multiplier takes priority when inject+active+onLose are on.
           Falls back to the bot's own martingale multiplier (applied to last actual buy price).

           STAKE OVERRIDE CEILING (Risk Manager):
           The Risk Manager "Stake (Override)" field works as a ceiling, same as the
           Trade Parameters "Stake Override":
           — When the computed RM stake reaches/exceeds overrideStake → reset to base stake.
           — When the standard martingale reaches/exceeds overrideStake (and inject is ON) → same reset. */
        const computeNextStake = (totalConsLoss: number, lastBuyPrice: number): number => {
            if (totalConsLoss === 0) return slotBaseStake();
            const rm = cfg.riskManager;
            if (rm.inject && rm.active && rm.onLose && totalConsLoss >= rm.activateLimit) {
                /* Deactivate limit: reset back to base after too many losses */
                if (rm.deactivateLimit > 0 && totalConsLoss >= rm.deactivateLimit) return slotBaseStake();
                /* RM martingale: grows from the base stake using the RM multiplier */
                const rmStake = +(slotBaseStake() * Math.pow(rm.multiplier, totalConsLoss - rm.activateLimit + 1)).toFixed(2);
                /* overrideStake = ceiling — matches the Trade Parameters "Stake Override" behaviour */
                if (rm.overrideStake > 0 && rmStake >= rm.overrideStake) return slotBaseStake();
                return rmStake;
            }
            /* Standard martingale: multiply the last actual buy price by the slot martingale factor */
            const martStake = +(lastBuyPrice * slotMartingale()).toFixed(2);
            /* When Risk Manager inject is ON, its overrideStake also caps standard martingale */
            if (rm.inject && rm.overrideStake > 0 && martStake >= rm.overrideStake) return slotBaseStake();
            return martStake;
        };

        let curStake = slotBaseStake();
        /* Tracks the last actual buy price from a settled contract so the next
           cycle's martingale is computed on the real paid amount, not the base. */
        let lastBuyPrice = curStake;
        /* Total consecutive losses across all cycles — drives market-switch and martingale. */
        let totalConsLoss = 0;

        /* ── FRESH XML RELOAD every time Run is pressed ──
           Await the load so the workspace is ready before the first trade fires. */
        addLog('📂 LOADING BOT STRATEGY...', 'hack');
        try { await onPreloadXml(bot, { market: curMarket, duration: cfg.duration }); } catch { /* non-fatal */ }
        patchWorkspaceParams({ duration: cfg.duration });
        addLog('📂 XML_TRADING_ACTIVATOR: FRESH STRATEGY LOADED ✓', 'hack');

        /* Force-fresh market feed subscription — always reconnect on every Run */
        if (tickUnsubRef.current) { tickUnsubRef.current(); tickUnsubRef.current = null; }
        lastTickAtRef.current = Date.now();
        curMarketRef.current = curMarket;
        marketListRef.current = marketList;
        multiScanRef.current = multiScan;

        /* Subscribe to first market (or all markets at once for parallel multi-market scan) */
        if (multiScan) {
            subscribeAllMarkets(marketList);
        } else {
            subscribeMarket(curMarket);
        }
        addLog(`▶ BOT ENGINE STARTED — ${contractLabel(bot)}`, 'start');
        await runHackerStartup(curMarket, cfg.useMarketSwitch);

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
                let entry = false;
                while (!entry && !stopRef.current) {
                    /* ── Network/feed watchdog: no real ticks for 30 s → force reconnect ──
                       lastTickAtRef is updated by every live tick in subscribeMarket, so this
                       only fires on a genuine feed freeze, not between normal tick intervals.
                       A 30 s cooldown prevents rapid-reconnect loops. */
                    const now = Date.now();
                    if (
                        !multiScan &&
                        now - lastTickAtRef.current > 30_000 &&
                        now - lastReconnectAtRef.current > 30_000
                    ) {
                        addLog('⚠ FEED_STALL DETECTED — forcing reconnection...', 'error');
                        lastReconnectAtRef.current = now;
                        try {
                            if (tickUnsubRef.current) { tickUnsubRef.current(); tickUnsubRef.current = null; }
                            subscribeMarket(curMarket);
                            lastTickAtRef.current = Date.now();
                            addLog('🔌 FEED_RESTORED — reconnected to live market feed', 'hack');
                        } catch { /* retry on next iteration */ }
                        await new Promise(r => setTimeout(r, 800));
                    }

                    /* ── 2-min scan timeout: no entry found on this market ──
                       Rotate to the next market in the list, reload the XML bot
                       with the new market, and restart the scan. Martingale stake
                       is NOT reset — recovery carries across market rotations. */
                    if (!multiScan && cfg.useMarketSwitch && cfg.markets.length > 1
                        && Date.now() - scanStartedAt > 120_000) {
                        curMarketIdx = (curMarketIdx + 1) % marketList.length;
                        curMarket    = marketList[curMarketIdx];
                        curMarketRef.current = curMarket;
                        lastFiredGroupRef.current = null;
                        subscribeMarket(curMarket);
                        addLog(`⏱ SCAN_TIMEOUT — no entry in 2 min | rotating → ${curMarket} | reloading XML...`, 'switch');
                        try { await onPreloadXml(bot, { market: curMarket, duration: cfg.duration }); } catch { /* non-fatal */ }
                        patchWorkspaceParams({ market: curMarket, duration: cfg.duration });
                        marketSwitched = true;
                        break;
                    }

                    if (multiScan) {
                        if (readyMarketRef.current) {
                            curMarket = readyMarketRef.current;
                            readyMarketRef.current = null;
                            digitWindowRef.current = multiWindowsRef.current.get(curMarket) || [];
                            setActiveMarket(curMarket);
                            setDigitDisplay(digitWindowRef.current.slice(0, 20));
                            addLog(`🧬 STRATEGY_LOGIC: CONDITION MET ON ${curMarket} — ${contractLabel(bot)} LOCKED, EXECUTING`, 'switch');
                            entry = true;
                            break;
                        }
                    } else if (cfg.strategyLogic.active && cfg.strategyLogic.groups.length > 0) {
                        const inRecovery = totalConsLoss > 0;
                        const r = evaluateStrategyLogic(digitWindowRef.current, cfg.strategyLogic.groups, inRecovery, { prices: priceWindowRef.current, contractType: bot.contractType, prediction: bot.prediction });
                        if (r.hit) {
                            lastFiredGroupRef.current = r.group ?? null;
                            /* ── Plain-English condition interpretation in terminal ── */
                            if (r.group) {
                                if (inRecovery) {
                                    addLog(`🔄 RECOVERY MODE — relaxed entry (recovery limit used instead of ifLast)`, 'switch');
                                }
                                const ndpWindow = ndpWindowFor(r.group, inRecovery);
                                r.group.conditions.forEach((cond, idx) => {
                                    const desc = describeConditionFired(cond, digitWindowRef.current, inRecovery, idx > 0, offsetFor(cond, ndpWindow));
                                    addLog(`  ${idx === 0 ? '📋' : '     ↳'} ${desc}`, 'scan');
                                });
                                addLog(`  ⟹ ${describeBuyAction(bot.contractType, bot.prediction)}`, 'entry');
                            }
                            addLog(`🧬 STRATEGY_LOGIC: CONDITION MET${inRecovery ? ' (RECOVERY)' : ''} — ${contractLabel(bot)} LOCKED, EXECUTING`, 'switch');
                            entry = true;
                            break;
                        }
                    } else if (fastExecRef.current && digitWindowRef.current.length >= 1) {
                        /* ⚡ FAST EXECUTION — bypass strategy scan, fire on the very first tick */
                        addLog('⚡ FAST_EXEC: immediate entry (scan bypassed)', 'entry');
                        entry = true;
                    } else {
                        entry = checkEntry(digitWindowRef.current, bot.contractType, bot.prediction, priceWindowRef.current);
                    }
                    scanTick++;

                    if (!entry) {
                        /* Periodic status messages — kept light so they don't flood the log */
                        if (scanTick % 6 === 1) {
                            const recent = digitWindowRef.current.slice(0, 10).join(' ');
                            addLog(`ANALYZING_DIGIT_PATTERN: [${recent || '...'}]`, 'scan');
                        }
                        if (scanTick % 12 === 5) {
                            addLog(HACK_SCAN_MSGS[Math.floor(Math.random() * HACK_SCAN_MSGS.length)], 'hack');
                        }
                        if (scanTick % 15 === 9) {
                            addLog(`CONNECTION_SPEED: ${105 + Math.floor(Math.random() * 40)} Mbps`, 'hack');
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

                setEntryReady(true);
                addLog('⚡ ENTRY_SIGNAL: DETECTED — EXECUTING TRADE', 'entry');

                /* ── Dispatch WA signal for live signal widget ── */
                try {
                    window.dispatchEvent(new CustomEvent('wa:signal', { detail: {
                        market: curMarket, action: contractLabel(bot),
                        stake: `${curStake.toFixed(2)}`, ticks: cfg.duration,
                        confidence: 82 + Math.floor(Math.random() * 16),
                        bot: bot.name,
                    }}));
                } catch { /* non-fatal */ }

                /* ── First trade: wait for workspace + feed to fully initialise ──
                   Subsequent trades are tick-driven (zero artificial delay). */
                if (firstTradeRef.current) {
                    firstTradeRef.current = false;
                    addLog('🔧 INITIALISING_TRADE_ENGINE (first trade — normal speed)...', 'hack');
                    await new Promise(r => setTimeout(r, 800));
                }

                /* ── Fire the REAL Bot Builder XML bot ──
                   The loaded XML owns the actual buy plus its own martingale /
                   trade_again recovery loop; this call only (a) syncs market,
                   stake, martingale size and barrier into the workspace right
                   before triggering, (b) mirrors every settled contract into this
                   terminal log/summary, and (c) force-stops the XML bot the
                   instant a terminal-level guard (take profit / stop loss /
                   consecutive-loss limit) is breached — guards the XML itself
                   has no knowledge of. There is exactly ONE buyer: the XML bot. */
                const activeBarrier = slotBarrier();
                addLog(`📂 XML_RUN_TRIGGER: ${contractLabel(bot)} @ ${curMarket} | stake ${curStake.toFixed(2)} | mart x${slotMartingale()} | barrier ${activeBarrier ?? 'auto'}`, 'hack');

                const effectiveLossLimit = lastFiredGroupRef.current
                    ? Math.min(cfg.consecutiveLossLimit || Infinity, groupRecoveryLimit(lastFiredGroupRef.current))
                    : cfg.consecutiveLossLimit;

                /* ── Multi-contract: for multiple bots, fire cfg.multiTradeCount
                   sequential trades on the same entry signal. Each fires its own
                   XML run cycle and records a separate transaction row. ── */
                const tradeCount = bot.multiple ? Math.max(1, cfg.multiTradeCount || 1) : 1;
                if (tradeCount > 1) addLog(`📊 MULTI_CONTRACT: executing ${tradeCount} contracts on this entry signal`, 'hack');

                let cycle = { forceStopped: false, reason: null as 'tp' | 'sl' | 'loss_limit' | null, cycleProfit: 0, consLoss: 0, lastWon: true };
                for (let _ci = 0; _ci < tradeCount && !stopRef.current; _ci++) {
                    if (_ci > 0 && !stopRef.current) {
                        await new Promise(r => setTimeout(r, 250));
                        if (stopRef.current) break;
                    }
                    const contractTag = tradeCount > 1 ? `[C${_ci + 1}/${tradeCount}] ` : '';
                    if (tradeCount > 1) addLog(`  ▶ ${contractTag}FIRING CONTRACT`, 'hack');

                    cycle = await runXmlBotCycle({
                        market: curMarket, stake: curStake, martingale: slotMartingale(),
                        prediction: activeBarrier,
                        consecutiveLossLimit: effectiveLossLimit === Infinity ? Number.MAX_SAFE_INTEGER : effectiveLossLimit,
                        stopOnLoss: cfg.stopOnLoss || !!lastFiredGroupRef.current,
                        tpGuard: cfg.tpGuard, takeProfit: slotTakeProfit(), stopLoss: cfg.stopLoss,
                        sessionPnlRef,
                        /* Seed with the running total so a loss here extends the SAME
                           consecutive-loss chain the outer loop has been tracking —
                           across trades, across market switches, and across market-2
                           fallback — instead of restarting the count from this cycle. */
                        priorConsLoss: totalConsLoss,
                        onLog: (msg, kind) => addLog(`${contractTag}${msg}`, kind),
                        onSettled: ({ profit, won, market: mkt, buyPrice, exitDigit, consLoss }) => {
                            lastBuyPrice = buyPrice;
                            const txId = ++txIdRef.current;
                            setTxList(prev => [{
                                id: txId, time: ts(), market: mkt,
                                type: tradeCount > 1 ? `${contractLabel(bot)} #${_ci + 1}` : contractLabel(bot),
                                stake: buyPrice, barrier: activeBarrier, result: won ? 'won' : 'lost',
                                profit, exitDigit,
                            }, ...prev]);
                            const pnlStr = `${sessionPnlRef.current >= 0 ? '+' : ''}${sessionPnlRef.current.toFixed(2)} USD`;
                            if (won) {
                                winsRef.current++;
                                addLog(`${contractTag}✅ WIN  +${profit.toFixed(2)} USD  |  P/L: ${pnlStr}`, 'win');
                            } else {
                                lossesRef.current++;
                                /* consLoss is now the TRUE running consecutive-loss count
                                   (seeded via priorConsLoss above), not a per-trade 0/1 —
                                   this is what lets martingale keep escalating loss after
                                   loss until a win, even across a market switch. */
                                consLossRef.current = consLoss;
                                totalConsLoss = consLoss;
                                const nextStake = computeNextStake(consLoss, buyPrice);
                                addLog(`${contractTag}❌ LOSS  ${profit.toFixed(2)} USD  |  recovery: ${consLoss}/${effectiveLossLimit === Infinity ? '∞' : effectiveLossLimit}  |  P/L: ${pnlStr}`, 'loss');
                                addLog(`${contractTag}🛡 RECOVERY: next stake: ${nextStake.toFixed(2)} (×${slotMartingale()})`, 'switch');
                            }
                        },
                    });
                    if (cycle.forceStopped) break; // TP/SL hit — stop multi-contract loop
                }

                if (stopRef.current) break;
                setEntryReady(false);

                /* ── Guard-triggered stops (TP / SL) — always break immediately ── */
                if (cycle.forceStopped) {
                    consLossRef.current = cycle.consLoss;
                    totalConsLoss = cycle.consLoss;

                    if (cycle.reason === 'tp') {
                        addLog(`🎯 Take profit ${slotTakeProfit()} reached.`, 'stop');
                        setWinPopup({ profit: cycle.cycleProfit, stopped: true, sessionPnl: sessionPnlRef.current, wins: winsRef.current, losses: lossesRef.current, reason: 'take-profit' });
                        break;
                    }
                    if (cycle.reason === 'sl') {
                        addLog(`🛡 Stop loss -${cfg.stopLoss} triggered.`, 'stop');
                        setWinPopup({ profit: cycle.cycleProfit, stopped: true, sessionPnl: sessionPnlRef.current, wins: winsRef.current, losses: lossesRef.current, reason: 'stop-loss' });
                        break;
                    }
                    // loss_limit falls through to the loss handling below
                }

                /* ── Loss handling ──
                   Fires for EVERY single loss — either a guard-triggered force-stop (loss_limit)
                   or a normal single-trade loss (bot stopped by onStopButtonClick in onContract).
                   The terminal fully controls martingale stake and market switching.
                   The XML bot NEVER runs its own trade_again on a loss — it is force-stopped
                   by onContract above so the terminal can re-scan and control the next entry. */
                if (!cycle.lastWon) {
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
                        try { await onPreloadXml(bot, { market: curMarket, duration: cfg.duration }); } catch { /* non-fatal */ }
                        patchWorkspaceParams({ market: curMarket, duration: cfg.duration });
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
                        try { await onPreloadXml(bot, { market: curMarket, duration: cfg.duration }); } catch { /* non-fatal */ }
                        patchWorkspaceParams({ market: curMarket, duration: cfg.duration });
                        continue; // re-scan on new market with martingale stake
                    }

                    /* No switch — same market, continue scanning with accumulated martingale stake */
                    addLog(`🔄 RECOVERY: same market ${curMarket} | stake ${curStake.toFixed(2)} | barrier: ${activeBarrier ?? 'auto'}`, 'switch');
                    /* Small buffer between cycles — lets any lingering bot.stop event from the
                       previous cycle drain before the new cycle registers its own listeners,
                       preventing cross-cycle interference that would cause an immediate resolve. */
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }

                /* ── Natural WIN ──
                   XML bot stopped naturally after a win. Reset stake to base and stop
                   so the user presses RUN to begin a fresh entry-signal scan. */
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

                /* Check TP guard before stopping */
                if (cfg.tpGuard && sessionPnlRef.current >= slotTakeProfit()) {
                    addLog(`🎯 Take profit ${slotTakeProfit()} reached.`, 'stop');
                    setWinPopup({ profit: cycle.cycleProfit, stopped: true, sessionPnl: sessionPnlRef.current, wins: winsRef.current, losses: lossesRef.current, reason: 'take-profit' });
                    break;
                }

                /* ── Stop after every successful trade ──
                   Press RUN again to start a fresh scalp cycle. */
                addLog('🎉 TRADE WIN — Bot stopped. Press ▶ RUN to start a fresh scalp.', 'win');
                setWinPopup({ profit: cycle.cycleProfit, stopped: true, sessionPnl: sessionPnlRef.current, wins: winsRef.current, losses: lossesRef.current, reason: 'win' });
                break;

            } catch (err: any) {
                const errMsg = err?.error?.message || err?.message || 'Trade error — retrying...';
                addLog(`⚠ ${errMsg}`, 'error');
                /* Network/connection errors: force-resubscribe the market feed */
                const isNetworkErr = /network|disconnect|timeout|websocket|connection/i.test(errMsg);
                if (isNetworkErr) {
                    addLog('🔌 NETWORK_ERROR — forcing feed reconnect...', 'error');
                    try {
                        if (tickUnsubRef.current) { tickUnsubRef.current(); tickUnsubRef.current = null; }
                        subscribeMarket(curMarket);
                        lastTickAtRef.current = Date.now();
                        addLog('🔌 FEED_RECONNECTED — resuming scan...', 'hack');
                    } catch { /* will retry next iteration */ }
                }
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        if (tickUnsubRef.current) { tickUnsubRef.current(); tickUnsubRef.current = null; }
        if (multiScan) unsubscribeAllMarkets();
        tickSignalRef.current = null;
        /* ── Bot-stopped summary in terminal ── */
        const finalPnl   = sessionPnlRef.current;
        const totalTrades = winsRef.current + lossesRef.current;
        const winRate = totalTrades > 0 ? ((winsRef.current / totalTrades) * 100).toFixed(1) : '0.0';
        addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'separator');
        addLog(`⏹  BOT STOPPED`, 'stop-summary');
        addLog(`   Session P/L : ${finalPnl >= 0 ? '+' : ''}${finalPnl.toFixed(2)} USD`, finalPnl >= 0 ? 'win' : 'loss');
        addLog(`   Trades      : ${totalTrades}  |  Wins: ${winsRef.current}  |  Losses: ${lossesRef.current}  |  Win-rate: ${winRate}%`, 'info');
        addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'separator');
        setRunning(false);
        setEntryReady(false);
    }, [running, derivTrade, bot, cfg, addLog, subscribeMarket, subscribeAllMarkets, unsubscribeAllMarkets, onPreloadXml, runXmlBotCycle]);

    const stopBot = useCallback(() => {
        stopRef.current = true;
        /* Immediately kill the XML bot engine — don't wait for the cycle to finish */
        const rp: any = store?.run_panel;
        try { rp?.onStopButtonClick?.(); } catch {}
        addLog('⏹ STOP — halting immediately.', 'stop');
    }, [addLog, store]);

    /* Add/remove markets from multi-market list */
    const addMarket = () => {
        if (!cfg.markets.includes(addMarketSel)) {
            cfgSet({ markets: [...cfg.markets, addMarketSel] });
        }
    };
    const removeMarket = (m: string) => cfgSet({ markets: cfg.markets.filter(x => x !== m) });

    const marketLabel = (v: string) => ALL_MARKETS.find(m => m.value === v)?.label ?? v;

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
                                className={`sb-detail__fast-btn ${fastExec ? 'active' : ''}`}
                                onClick={() => setFastExec(f => !f)}
                                title='Fast Execution: bypass entry scan, fire instantly on first tick'
                            >
                                ⚡ {fastExec ? 'FAST ON' : 'FAST'}
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
                {/* ── Left Sidebar — Config ── */}
                <div className='sb-detail__sidebar'>

                    {/* Builder buttons */}
                    <div className='sb-bot-actions'>
                        <button className='sb-bot-action-btn' onClick={() => { setLoadingXml(true); onLoadXml(bot).finally(() => setLoadingXml(false)); }} disabled={loadingXml}>
                            📁 DEFAULT BOT
                        </button>
                        <button className='sb-bot-action-btn' onClick={() => { setLoadingXml(true); onLoadAndRun(bot).finally(() => setLoadingXml(false)); }} disabled={loadingXml}>
                            ▶ SELECT BOT
                        </button>
                        <button className='sb-bot-action-btn' disabled>
                            ⬆ UPLOAD BOT
                        </button>
                        <button className='sb-bot-action-btn' disabled>
                            ⬇ DOWNLOAD
                        </button>
                    </div>

                    {/* ── GLOBAL SHARED ── */}
                    <div className='sb-global-label'>GLOBAL SHARED</div>

                    {/* Trade Parameters */}
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
                                <NumberField value={cfg.duration} min={1} max={10}
                                    onCommit={n => cfgSet({ duration: n })} disabled={running} />
                                <span className='sb-unit'>Ticks</span>
                            </div>
                            <div className='sb-field'>
                                <label>Stake (USD)</label>
                                <NumberField value={cfg.stake} min={0.35} step={0.01}
                                    onCommit={n => cfgSet({ stake: n })} disabled={running} />
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

                    {/* Stop Trading */}
                    <SbAccordion title='Stop Trading' badge={cfg.stopOnLoss ? 'ACTIVE' : 'DISABLED'} badgeColor={cfg.stopOnLoss ? '#22c55e' : '#64748b'} defaultOpen>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Stop After Losses</label>
                            <button className={`sb-toggle ${cfg.stopOnLoss ? 'on' : 'off'}`}
                                onClick={() => cfgSet({ stopOnLoss: !cfg.stopOnLoss })} disabled={running}>
                                {cfg.stopOnLoss ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        {cfg.stopOnLoss && (
                            <>
                                <div className='sb-field'>
                                    <label>Consecutive Losses</label>
                                    <NumberField value={cfg.consecutiveLossLimit} min={1} max={20}
                                        onCommit={n => cfgSet({ consecutiveLossLimit: n })} disabled={running} />
                                </div>
                                <p className='sb-hint'>Bot stops after {cfg.consecutiveLossLimit} consecutive losses.</p>
                            </>
                        )}
                    </SbAccordion>

                    {/* TP/SL Guard */}
                    <SbAccordion title='TP/SL Guard' badge={cfg.tpGuard ? 'ACTIVE' : 'DISABLED'} badgeColor={cfg.tpGuard ? '#22c55e' : '#64748b'} defaultOpen>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>TP/SL Guard</label>
                            <button className={`sb-toggle ${cfg.tpGuard ? 'on' : 'off'}`}
                                onClick={() => cfgSet({ tpGuard: !cfg.tpGuard })} disabled={running}>
                                {cfg.tpGuard ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        {cfg.tpGuard && (
                            <>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Take Profit ($)</label>
                                        <NumberField value={cfg.takeProfit} min={1}
                                            onCommit={n => cfgSet({ takeProfit: n })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Stop Loss ($)</label>
                                        <NumberField value={cfg.stopLoss} min={1}
                                            onCommit={n => cfgSet({ stopLoss: n })} disabled={running} />
                                    </div>
                                </div>
                                <div className='sb-tpsl-bar'>
                                    <span className='sb-tpsl-tp'>TP +{cfg.takeProfit}</span>
                                    <span className='sb-tpsl-sl'>SL -{cfg.stopLoss}</span>
                                </div>
                            </>
                        )}
                    </SbAccordion>

                    {/* LDP Info Popup */}
                    {ldpInfoOpen && (
                        <div className='sb-ldp-overlay' onClick={() => setLdpInfoOpen(null)}>
                            <div className='sb-ldp-popup' onClick={e => e.stopPropagation()}>
                                <div className='sb-ldp-popup__title'>HOW LDP WORKS</div>
                                <div className='sb-ldp-popup__sub'>LDP PATTERN ENGINE</div>
                                <p className='sb-ldp-popup__desc'>Analyzes the frequency of a specific digit appearing consecutively in the market history to trigger an entry.</p>
                                <div className='sb-ldp-popup__items'>
                                    <div className='sb-ldp-item'>
                                        <span className='sb-ldp-item__num'>1</span>
                                        <div>
                                            <strong>Occurrence Limit</strong>
                                            <p>Counts how many times your chosen digit appears consecutively in the recent history.</p>
                                        </div>
                                    </div>
                                    <div className='sb-ldp-item'>
                                        <strong>Strict</strong>
                                        <p>Occurrence from ldp trend start or anywhere in the trend</p>
                                    </div>
                                    <div className='sb-ldp-item'>
                                        <span className='sb-ldp-item__num'>2</span>
                                        <div>
                                            <strong>Recovery Logic</strong>
                                            <p>Uses the Recovery Limit to adjust sensitivity during different market phases.</p>
                                        </div>
                                    </div>
                                </div>
                                <button className='sb-ldp-popup__close' onClick={() => setLdpInfoOpen(null)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {/* Strategy Logic */}
                    <SbAccordion title='💡 Strategy Logic' badge={cfg.strategyLogic.active ? 'ACTIVE' : 'DISABLED'} badgeColor={cfg.strategyLogic.active ? '#22c55e' : '#64748b'} defaultOpen>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Global Shared</label>
                            <button className={`sb-toggle ${cfg.strategyLogic.globalShared ? 'on' : 'off'}`}
                                onClick={() => slSet({ globalShared: !cfg.strategyLogic.globalShared })} disabled={running}>
                                {cfg.strategyLogic.globalShared ? 'ENABLED' : 'DISABLED'}
                            </button>
                        </div>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Strategy</label>
                            <button className={`sb-toggle ${cfg.strategyLogic.active ? 'on' : 'off'}`}
                                onClick={() => slSet({ active: !cfg.strategyLogic.active })} disabled={running}>
                                {cfg.strategyLogic.active ? 'ACTIVE' : 'INACTIVE'}
                            </button>
                        </div>
                        {cfg.strategyLogic.active && (
                            <>
                                {cfg.strategyLogic.groups.map((g, gIdx) => (
                                    <div key={g.id} className='sb-or-group'>
                                        <div className='sb-or-group__header'>
                                            <span className='sb-or-group__badge'>OR GROUP #{gIdx + 1}</span>
                                            {cfg.strategyLogic.groups.length > 1 && !running && (
                                                <button className='sb-condition-delete' onClick={() => removeGroup(g.id)} title='Delete group'>🗑</button>
                                            )}
                                        </div>
                                        <div className='sb-or-group__body'>
                                            {g.conditions.map((cond, cIdx) => (
                                                <div key={cond.id} className='sb-cond-block'>
                                                    {/* Condition header */}
                                                    <div className='sb-cond-block__header'>
                                                        <span className={`sb-condition-label ${cIdx > 0 ? 'and' : ''}`}>
                                                            {cIdx === 0 ? 'CONDITION' : 'AND CONDITION'}
                                                        </span>
                                                        <div className='sb-cond-block__actions'>
                                                            {g.conditions.length > 1 && !running && (
                                                                <button className='sb-condition-delete' onClick={() => removeCondition(g.id, cond.id)} title='Remove'>🗑</button>
                                                            )}
                                                            <button className='sb-ldp-info-btn' onClick={() => setLdpInfoOpen(cond.id)} title='How LDP works'>ⓘ</button>
                                                        </div>
                                                    </div>

                                                    {/* Algorithm */}
                                                    <div className='sb-field'>
                                                        <label>Algorithm</label>
                                                        <select value={cond.algorithm}
                                                            onChange={e => conditionSet(g.id, cond.id, { algorithm: e.target.value as AlgorithmType })}
                                                            disabled={running}>
                                                            {ALGORITHM_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                                                        </select>
                                                    </div>

                                                    {/* Algorithm description chip */}
                                                    <div className='sb-algo-desc'>
                                                        {cond.algorithm === 'LDP' && 'Last-Digit Pattern: checks consecutive digit streaks'}
                                                        {cond.algorithm === 'Market Percentage' && 'Statistical: fires when ≥X% of recent digits match'}
                                                        {cond.algorithm === 'Sequence Radar' && 'Pattern: detects alternating / trend / zigzag sequences'}
                                                        {cond.algorithm === 'Complex Patterns' && 'Multi-phase: compares first vs second half of window'}
                                                        {cond.algorithm === 'Entry Point Pattern' && 'Reversal: pressure-based entry from sensitivity streak'}
                                                        {cond.algorithm === 'NDP' && 'Next Digit Prediction: checks the next consecutive digit streak — add it as an AND condition after LDP so both must be met to enter'}
                                                    </div>

                                                    {/* Window size (If Last) */}
                                                    <div className='sb-field-row'>
                                                        <div className='sb-field'>
                                                            <label>If Last (window)</label>
                                                            <select value={cond.ifLast}
                                                                onChange={e => conditionSet(g.id, cond.id, { ifLast: Number(e.target.value) })}
                                                                disabled={running}>
                                                                {IF_LAST_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                                                            </select>
                                                        </div>
                                                        {/* Strict toggle — LDP and NDP share the same strict/majority logic */}
                                                        {(cond.algorithm === 'LDP' || cond.algorithm === 'NDP') && (
                                                            <div className='sb-field-row sb-field-row--center'>
                                                                <label>Strict</label>
                                                                <button className={`sb-toggle ${cond.strict ? 'on' : 'off'}`}
                                                                    onClick={() => conditionSet(g.id, cond.id, { strict: !cond.strict })} disabled={running}>
                                                                    {cond.strict ? 'ON' : 'OFF'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Algorithm-specific fields */}
                                                    {(cond.algorithm === 'LDP' || cond.algorithm === 'NDP' || cond.algorithm === 'Market Percentage' || cond.algorithm === 'Entry Point Pattern') && (
                                                        <div className='sb-field-row'>
                                                            <div className='sb-field'>
                                                                <label>Digits Is</label>
                                                                <select value={cond.digitsIs}
                                                                    onChange={e => conditionSet(g.id, cond.id, { digitsIs: e.target.value as DigitsIsType })}
                                                                    disabled={running}>
                                                                    {DIGITS_IS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
                                                            </div>
                                                            {['OVER','UNDER','MATCHES','DIFFERS'].includes(cond.digitsIs) && (
                                                                <div className='sb-field'>
                                                                    <label>Digit</label>
                                                                    <select value={cond.digitValue ?? 5}
                                                                        onChange={e => conditionSet(g.id, cond.id, { digitValue: Number(e.target.value) })}
                                                                        disabled={running}>
                                                                        {[0,1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                                                                    </select>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Market Percentage — threshold */}
                                                    {cond.algorithm === 'Market Percentage' && (
                                                        <div className='sb-field'>
                                                            <label>Threshold %</label>
                                                            <NumberField value={cond.percentageThreshold ?? 60} min={50} max={100}
                                                                onCommit={n => conditionSet(g.id, cond.id, { percentageThreshold: n })} disabled={running} />
                                                            <span className='sb-unit'>% of window</span>
                                                        </div>
                                                    )}

                                                    {/* Sequence Radar — sequence type */}
                                                    {cond.algorithm === 'Sequence Radar' && (
                                                        <div className='sb-field'>
                                                            <label>Sequence Type</label>
                                                            <select value={cond.sequenceType ?? 'alternating'}
                                                                onChange={e => conditionSet(g.id, cond.id, { sequenceType: e.target.value as any })}
                                                                disabled={running}>
                                                                <option value='alternating'>Alternating (ODD↔EVEN)</option>
                                                                <option value='increasing'>Increasing (each ≥ prev)</option>
                                                                <option value='decreasing'>Decreasing (each ≤ prev)</option>
                                                                <option value='zigzag'>Zigzag (direction flips)</option>
                                                                <option value='flat'>Flat (low volatility ≤2 range)</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {/* Complex Patterns — pattern type */}
                                                    {cond.algorithm === 'Complex Patterns' && (
                                                        <div className='sb-field'>
                                                            <label>Pattern</label>
                                                            <select value={cond.complexPattern ?? 'high-low'}
                                                                onChange={e => conditionSet(g.id, cond.id, { complexPattern: e.target.value as any })}
                                                                disabled={running}>
                                                                <option value='high-low'>High → Low (avg drops second half)</option>
                                                                <option value='low-high'>Low → High (avg rises second half)</option>
                                                                <option value='ramp-up'>Ramp Up (linear rise slope ≥0.5)</option>
                                                                <option value='ramp-down'>Ramp Down (linear drop slope ≤-0.5)</option>
                                                                <option value='spike'>Spike (outlier digit ±3 from mean)</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {/* Entry Point Pattern — sensitivity */}
                                                    {cond.algorithm === 'Entry Point Pattern' && (
                                                        <div className='sb-field'>
                                                            <label>Sensitivity</label>
                                                            <select value={cond.sensitivity ?? 'medium'}
                                                                onChange={e => conditionSet(g.id, cond.id, { sensitivity: e.target.value as any })}
                                                                disabled={running}>
                                                                <option value='high'>High — 2 tick reversal (fast)</option>
                                                                <option value='medium'>Medium — 3 tick reversal</option>
                                                                <option value='low'>Low — 5 tick reversal (conservative)</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    {/* Recovery Limit */}
                                                    <div className='sb-field-row'>
                                                        <div className='sb-field'>
                                                            <label>Recovery Limit</label>
                                                            <NumberField value={cond.recoveryLimit} min={0} max={20}
                                                                onCommit={n => conditionSet(g.id, cond.id, { recoveryLimit: n })} disabled={running} />
                                                            <span className='sb-unit' title='After a loss: relaxed window size (faster re-entry, same contract type)'>ticks after loss</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* + ADD AND LOGIC */}
                                            {!running && (
                                                <button className='sb-add-and-btn' onClick={() => addCondition(g.id)}>
                                                    + ADD AND LOGIC
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {!running && (
                                    <button className='sb-add-condition-btn' onClick={addGroup}>+ ADD OR GROUP</button>
                                )}
                                <p className='sb-hint'>When the condition is true, the terminal fires the XML trading activator and executes the trade automatically.</p>
                            </>
                        )}
                    </SbAccordion>

                    {/* Multiple Contracts — fires N contracts per entry signal */}
                    {bot.multiple && (
                        <SbAccordion title='📊 Multiple Contracts' badge={`${cfg.multiTradeCount}× per entry`} badgeColor='#818cf8'>
                            <div className='sb-field-row'>
                                <div className='sb-field'>
                                    <label>Contracts per Entry</label>
                                    <NumberField value={cfg.multiTradeCount} min={1} max={5}
                                        onCommit={n => setCfg(c => ({ ...c, multiTradeCount: n }))} disabled={running} />
                                    <span className='sb-unit'>contracts fired on each entry signal</span>
                                </div>
                            </div>
                            <p className='sb-hint'>Fires this many sequential contracts on each entry. Each contract records separately in Transactions.</p>
                        </SbAccordion>
                    )}

                    {/* Risk Manager */}
                    <SbAccordion title='Risk Manager' badge={cfg.riskManager.inject ? 'INJECTED' : 'STANDARD'} badgeColor={cfg.riskManager.inject ? '#f59e0b' : '#64748b'}>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Inject Risk Manager</label>
                            <button className={`sb-toggle ${cfg.riskManager.inject ? 'on' : 'off'}`}
                                onClick={() => rmSet({ inject: !cfg.riskManager.inject })} disabled={running}>
                                {cfg.riskManager.inject ? 'ENABLED' : 'DISABLED'}
                            </button>
                        </div>
                        {cfg.riskManager.inject ? (
                            <>
                                <div className='sb-rm-type'>Martingale <span className='sb-rm-info'>ⓘ</span></div>
                                <div className='sb-field-row sb-field-row--center'>
                                    <label>Risk Manager</label>
                                    <button className={`sb-toggle ${cfg.riskManager.active ? 'on' : 'off'}`}
                                        onClick={() => rmSet({ active: !cfg.riskManager.active })} disabled={running}>
                                        {cfg.riskManager.active ? 'ACTIVE' : 'INACTIVE'}
                                    </button>
                                </div>
                                <div className='sb-field-row sb-field-row--center'>
                                    <label>On Lose</label>
                                    <button className={`sb-toggle ${cfg.riskManager.onLose ? 'on' : 'off'}`}
                                        onClick={() => rmSet({ onLose: !cfg.riskManager.onLose })} disabled={running}>
                                        {cfg.riskManager.onLose ? 'ACTIVE' : 'INACTIVE'}
                                    </button>
                                </div>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Activate Limit</label>
                                        <NumberField value={cfg.riskManager.activateLimit} min={1} max={50}
                                            onCommit={n => rmSet({ activateLimit: n })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Deactivate Limit</label>
                                        <NumberField value={cfg.riskManager.deactivateLimit} min={1} max={500}
                                            onCommit={n => rmSet({ deactivateLimit: n })} disabled={running} />
                                    </div>
                                </div>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Multiplier</label>
                                        <NumberField value={cfg.riskManager.multiplier} min={1} max={10} step={0.5}
                                            onCommit={n => rmSet({ multiplier: n })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Stake (override)</label>
                                        <NumberField value={cfg.riskManager.overrideStake} min={0.35} step={0.01}
                                            onCommit={n => rmSet({ overrideStake: n })} disabled={running} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className='sb-field'>
                                    <label>Martingale ×</label>
                                    <NumberField value={cfg.martingale} min={1} max={10} step={0.5}
                                        onCommit={n => cfgSet({ martingale: n })} disabled={running} />
                                </div>
                                <p className='sb-hint'>Standard martingale — stake × {cfg.martingale} on each loss.</p>
                            </>
                        )}
                    </SbAccordion>

                    {/* Market Switcher */}
                    <SbAccordion title='Market Switcher' badge={cfg.useMarketSwitch ? 'ACTIVE' : 'OFF'} badgeColor={cfg.useMarketSwitch ? '#06b6d4' : '#64748b'}>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Auto Switch Markets</label>
                            <button className={`sb-toggle ${cfg.useMarketSwitch ? 'on' : 'off'}`}
                                onClick={() => cfgSet({ useMarketSwitch: !cfg.useMarketSwitch })} disabled={running}>
                                {cfg.useMarketSwitch ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        {cfg.useMarketSwitch && (
                            <>
                                <div className='sb-field'>
                                    <label>Switch After Losses</label>
                                    <NumberField value={cfg.switchOnLosses} min={1} max={10}
                                        onCommit={n => cfgSet({ switchOnLosses: n })} disabled={running} />
                                    <span className='sb-unit'>losses</span>
                                </div>
                                <p className='sb-hint'>Switches to the next market after {cfg.switchOnLosses} consecutive losses.</p>
                                <div className='sb-markets-list'>
                                    {cfg.markets.map(m => (
                                        <div key={m} className='sb-market-pill'>
                                            <span>{marketLabel(m)}</span>
                                            {!running && (
                                                <button className='sb-market-remove' onClick={() => removeMarket(m)}>×</button>
                                            )}
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

                    {/* MARKET 2 — alternate slot with its own stake/martingale/TP/barrier */}
                    <SbAccordion title='MARKET 2 (Switch Target)' badge={cfg.market2.enabled ? 'ENABLED' : 'DISABLED'} badgeColor={cfg.market2.enabled ? '#a855f7' : '#64748b'}>
                        <div className='sb-field-row sb-field-row--center'>
                            <label>Enable Market 2</label>
                            <button className={`sb-toggle ${cfg.market2.enabled ? 'on' : 'off'}`}
                                onClick={() => m2Set({ enabled: !cfg.market2.enabled })} disabled={running}>
                                {cfg.market2.enabled ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        {cfg.market2.enabled && (
                            <>
                                <div className='sb-field'>
                                    <label>Market</label>
                                    <select value={cfg.market2.market} onChange={e => m2Set({ market: e.target.value })} disabled={running}>
                                        {ALL_MARKETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Stake</label>
                                        <NumberField value={cfg.market2.stake} min={0.35} step={0.01}
                                            onCommit={n => m2Set({ stake: n })} disabled={running} />
                                    </div>
                                    <div className='sb-field'>
                                        <label>Martingale ×</label>
                                        <NumberField value={cfg.market2.martingale} min={1} max={10} step={0.5}
                                            onCommit={n => m2Set({ martingale: n })} disabled={running} />
                                    </div>
                                </div>
                                <div className='sb-field-row sb-field-row--center'>
                                    <label>Stake Override</label>
                                    <button className={`sb-toggle ${cfg.market2.useStakeOverride ? 'on' : 'off'}`}
                                        onClick={() => m2Set({ useStakeOverride: !cfg.market2.useStakeOverride })} disabled={running}>
                                        {cfg.market2.useStakeOverride ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                                {cfg.market2.useStakeOverride && (
                                    <div className='sb-field'>
                                        <label>Override Ceiling (USD)</label>
                                        <NumberField value={cfg.market2.stakeOverride} min={cfg.market2.stake} step={0.01}
                                            onCommit={n => m2Set({ stakeOverride: n })} disabled={running} />
                                        <span className='sb-unit'>USD</span>
                                        <p className='sb-hint'>When Market 2 martingale stake reaches {cfg.market2.stakeOverride.toFixed(2)}, reset back to base {cfg.market2.stake.toFixed(2)}.</p>
                                    </div>
                                )}
                                <div className='sb-field-row'>
                                    <div className='sb-field'>
                                        <label>Take Profit</label>
                                        <NumberField value={cfg.market2.takeProfit} min={1} step={1}
                                            onCommit={n => m2Set({ takeProfit: n })} disabled={running} />
                                    </div>
                                    {bot.prediction !== null && (
                                        <div className='sb-field'>
                                            <label>Barrier / Digit</label>
                                            <NumberField value={cfg.market2.barrier} min={0} max={9} step={1}
                                                onCommit={n => m2Set({ barrier: n })} disabled={running} />
                                        </div>
                                    )}
                                </div>
                                <p className='sb-hint'>
                                    Contract type stays locked to {contractLabel(bot)}. When the market-switch loss
                                    limit is hit on Market 1, the terminal switches here — using this market, stake,
                                    martingale and take profit — until it wins, then returns to Market 1.
                                </p>
                            </>
                        )}
                    </SbAccordion>

                    {/* MARKET1 Section */}
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
                        <p className='sb-hint'>Entry condition: {
                            bot.contractType === 'DIGITEVEN' ? '≥3 consecutive ODD digits → bet EVEN' :
                            bot.contractType === 'DIGITODD'  ? '≥3 consecutive EVEN digits → bet ODD' :
                            bot.contractType === 'DIGITOVER' ? `≥2 consecutive digits ≤${bot.prediction} → bet OVER` :
                            `≥2 consecutive digits >${bot.prediction} → bet UNDER`
                        }</p>
                    </SbAccordion>
                </div>

                {/* ── Right — Terminal + VPS panel ── */}
                <div className='sb-detail__terminal-col' style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* VPS Done notification overlay */}
                    {vpsDonePopup && (
                        <div className='vps-done-overlay' onClick={() => setVpsDonePopup(null)}>
                            <div className='vps-done-modal' onClick={e => e.stopPropagation()}>
                                <div className='vps-done-modal__icon'>🏁</div>
                                <div className='vps-done-modal__title'>SCALPING WORK DONE</div>
                                <div className='vps-done-modal__reason'>{vpsDonePopup.reason}</div>
                                <div className={`vps-done-modal__pnl ${vpsDonePopup.pnl >= 0 ? 'pos' : 'neg'}`}>
                                    {vpsDonePopup.pnl >= 0 ? '+' : ''}{vpsDonePopup.pnl.toFixed(2)} USD
                                </div>
                                <div className='vps-done-modal__stats'>
                                    <div className='vps-done-modal__stat'><span>Total Runs</span><strong>{vpsDonePopup.runs}</strong></div>
                                    <div className='vps-done-modal__stat'><span>Status</span><strong>Completed</strong></div>
                                </div>
                                <button className='vps-done-modal__ok' onClick={() => setVpsDonePopup(null)}>OK</button>
                            </div>
                        </div>
                    )}

                    {/* VPS Mode panel — shown above the terminal when enabled or always visible */}
                    <VpsMode
                        enabled={vpsEnabled}
                        settings={vpsSettings}
                        running={running}
                        authorized={derivTrade.authorized}
                        lastTickAtRef={lastTickAtRef}
                        sessionPnlRef={sessionPnlRef}
                        vpsRuns={vpsRuns}
                        vpsPnl={vpsPnl}
                        onToggle={enabled => {
                            setVpsEnabled(enabled);
                            if (enabled) {
                                setVpsRuns(0);
                                setVpsPnl(0);
                                // VPS enables fast mode
                                if (!running) setCfg(c => c);
                            }
                        }}
                        onSettingsChange={s => setVpsSettings(s)}
                        onForceReconnect={() => {
                            // Real feed reconnect (not just a log message) — resubscribes the
                            // live tick stream for the market currently being scanned so the
                            // terminal actually recovers from a stalled feed, instead of just
                            // repeating the stall warning forever.
                            try {
                                if (tickUnsubRef.current) { tickUnsubRef.current(); tickUnsubRef.current = null; }
                                subscribeMarket(curMarketRef.current);
                                lastTickAtRef.current = Date.now();
                                lastReconnectAtRef.current = Date.now();
                            } catch { /* retried again by the next VPS health check */ }
                        }}
                        onRequestRestart={() => {
                            if (running) return;
                            setVpsRuns(r => r + 1);
                            /* Accumulate, don't overwrite — vpsPnl must hold the running total
                               across every VPS run (matching Summary/Transactions), or a
                               TP/SL that only ever reflects the last run's P/L never actually
                               triggers off the real cumulative total. */
                            setVpsPnl(p => +(p + sessionPnlRef.current).toFixed(2));
                            sessionPnlRef.current = 0;
                            // Re-fire the terminal's own RUN handler directly — do not rely on a
                            // DOM selector (the terminal's actual class is .sb-detail__start-btn,
                            // not .sb-run-btn, so a querySelector click here would silently no-op).
                            setTimeout(() => {
                                if (!running && derivTrade.authorized) startBot();
                            }, 500);
                        }}
                        onDone={reason => {
                            setVpsDonePopup({ reason, pnl: vpsPnl + sessionPnlRef.current, runs: vpsRuns });
                            setVpsEnabled(false);
                        }}
                    />

                {/* ─── Terminal inner wrapper ─── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {winPopup && (
                        <div className='sb-win-overlay' onClick={() => setWinPopup(null)}>
                            <div className={`sb-win-modal ${winPopup.stopped ? (winPopup.sessionPnl >= 0 ? 'stopped-win' : 'stopped-loss') : 'cycle-win'}`}
                                 onClick={e => e.stopPropagation()}>
                                {/* Animated glow ring */}
                                <div className='sb-win-modal__glow' />

                                {/* Icon */}
                                <div className='sb-win-modal__icon'>
                                    {winPopup.reason === 'win' ? '🏆' :
                                     winPopup.reason === 'take-profit' ? '🎯' :
                                     winPopup.reason === 'stop-loss' ? '🛡' :
                                     winPopup.reason === 'loss-limit' ? '⚠️' : '⏹'}
                                </div>

                                {/* Title */}
                                <div className='sb-win-modal__title'>
                                    {winPopup.stopped
                                        ? (winPopup.reason === 'take-profit' ? 'TAKE PROFIT HIT'
                                           : winPopup.reason === 'stop-loss'  ? 'STOP LOSS TRIGGERED'
                                           : winPopup.reason === 'loss-limit' ? 'LOSS LIMIT REACHED'
                                           : 'BOT STOPPED')
                                        : 'TRADE WON'}
                                </div>

                                {/* Cycle P/L */}
                                <div className={`sb-win-modal__amount ${winPopup.profit >= 0 ? 'pos' : 'neg'}`}>
                                    {winPopup.profit >= 0 ? '+' : ''}{winPopup.profit.toFixed(2)} USD
                                </div>

                                {/* Session summary stats */}
                                {winPopup.stopped && (
                                    <div className='sb-win-modal__stats'>
                                        <div className='sb-win-modal__stat'>
                                            <span>Session P/L</span>
                                            <strong className={winPopup.sessionPnl >= 0 ? 'pos' : 'neg'}>
                                                {winPopup.sessionPnl >= 0 ? '+' : ''}{winPopup.sessionPnl.toFixed(2)} USD
                                            </strong>
                                        </div>
                                        <div className='sb-win-modal__stat'>
                                            <span>Trades</span>
                                            <strong>{winPopup.wins + winPopup.losses}</strong>
                                        </div>
                                        <div className='sb-win-modal__stat'>
                                            <span>Wins / Losses</span>
                                            <strong><span className='pos'>{winPopup.wins}</span> / <span className='neg'>{winPopup.losses}</span></strong>
                                        </div>
                                        {(winPopup.wins + winPopup.losses) > 0 && (
                                            <div className='sb-win-modal__stat'>
                                                <span>Win Rate</span>
                                                <strong>{((winPopup.wins / (winPopup.wins + winPopup.losses)) * 100).toFixed(1)}%</strong>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Subtitle */}
                                <div className='sb-win-modal__subtitle'>
                                    {winPopup.stopped ? 'Session complete' : 'Recovery cleared — continuing scan'}
                                </div>

                                {/* CTA button */}
                                <button className='sb-win-modal__ok' onClick={() => setWinPopup(null)}>
                                    {winPopup.stopped ? 'OK' : 'Continue →'}
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Active market indicator */}
                    <div className='sb-terminal-market-bar'>
                        <span className='sb-terminal-market-label'>ACTIVE MARKET:</span>
                        <span className='sb-terminal-market-value'>{activeMarket}</span>
                        {entryReady && <span className='sb-entry-ready'>⚡ ENTRY SIGNAL</span>}
                        {running && <span className='sb-terminal__live'>● LIVE</span>}
                    </div>

                    {/* Live digit window */}
                    <div className='sb-digit-window'>
                        {digitDisplay.length === 0 ? (
                            <span className='sb-digit-window__empty'>waiting for ticks…</span>
                        ) : digitDisplay.map((d, i) => (
                            <span key={i} className={`sb-digit-chip ${i === 0 ? 'latest' : ''}`}>{d}</span>
                        ))}
                    </div>

                    {/* Terminal */}
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
                            {summary.runs === 0 ? (
                                <div className='sb-summary__empty'>
                                    <p>Bot is not running</p>
                                    <p>When you're ready to trade, hit RUN. You'll be able to track your bot's performance here.</p>
                                </div>
                            ) : (
                                <div className='sb-summary__stats'>
                                    <div className='sb-stat'><span>TOTAL RUNS</span><strong>{summary.runs}</strong></div>
                                    <div className='sb-stat green'><span>WINS</span><strong>{summary.won}</strong></div>
                                    <div className='sb-stat red'><span>LOSSES</span><strong>{summary.lost}</strong></div>
                                    <div className={`sb-stat ${summary.pnl >= 0 ? 'green' : 'red'}`}>
                                        <span>NET P/L</span>
                                        <strong>{summary.pnl >= 0 ? '+' : ''}{summary.pnl.toFixed(2)} USD</strong>
                                    </div>
                                    <div className='sb-stat'>
                                        <span>WIN RATE</span>
                                        <strong>{summary.runs > 0 ? ((summary.won / summary.runs) * 100).toFixed(1) : '0.0'}%</strong>
                                    </div>
                                </div>
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
                                        <tr>
                                            <th>Time</th><th>Market</th><th>Type</th>
                                            <th>Stake</th><th>Result</th><th>Exit Digit</th><th>Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {txList.map(tx => (
                                            <tr key={tx.id} className={tx.result}>
                                                <td>{tx.time}</td>
                                                <td>{tx.market}</td>
                                                <td>{tx.type}</td>
                                                <td>${tx.stake.toFixed(2)}</td>
                                                <td className={`sb-result-${tx.result}`}>
                                                    {tx.result === 'open' ? '⏳' : tx.result === 'won' ? '✓ WIN' : '✗ LOSS'}
                                                </td>
                                                <td>{tx.exitDigit ?? '—'}</td>
                                                <td className={tx.profit >= 0 ? 'green' : 'red'}>
                                                    {tx.result === 'open' ? '…' : `${tx.profit >= 0 ? '+' : ''}${tx.profit.toFixed(2)}`}
                                                </td>
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
                                <p className='sb-empty'>No journal entries yet. Run the bot to see activity.</p>
                            ) : terminal.slice().reverse().map((e, i) => (
                                <div key={i} className={`sb-journal__line ${e.kind}`}>
                                    <span className='sb-journal__ts'>{e.t}</span>
                                    {e.msg}
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
    /* null = showing the folder picker (group icons); once a folder is opened
       we show only that group's bots. Search bypasses folders entirely. */
    const [openGroup, setOpenGroup] = useState<SbGroup | null>(null);
    const [search, setSearch]       = useState('');
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

    /* Robust XML loader — tries the store API first, falls back to direct Blockly DOM inject.
       Returns true when the workspace was successfully updated. */
    const loadXmlIntoWorkspace = useCallback(async (xml: string, name: string): Promise<boolean> => {
        // Attempt 1: store's loadStrategyToBuilder (handles unsupported elements gracefully)
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
            const xml = await res.text();
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
    const handlePreloadXml = useCallback(async (bot: TScalperBot, opts?: { market?: string; duration?: number }) => {
        try {
            const res = await fetch(bot.xmlFile);
            if (!res.ok) return;
            let xml = await res.text();
            // Patch XML with current market + duration before loading into workspace
            if (opts?.market || opts?.duration != null) {
                xml = patchXmlContent(xml, opts.market, opts.duration);
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
                onPreloadXml={handlePreloadXml}
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
