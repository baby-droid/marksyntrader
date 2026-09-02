// @ts-nocheck — the surrounding trading surface intentionally keeps the
// Deriv response objects flexible because the API has different envelopes for
// history, ticks, proposals, and open contracts.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useDerivTrade } from '@/hooks/useDerivTrade';
import NumberField from '@/components/number-field';
import { fromUsd, getDisplayCurrency, subscribeCurrency } from '@/utils/currency-display';
import { setTradeContext } from '@/utils/trade-metadata';
import './auto-digits.scss';

const FALLBACK_MARKETS = [
    { label: 'Volatility 10', value: 'R_10' },
    { label: 'Volatility 25', value: 'R_25' },
    { label: 'Volatility 50', value: 'R_50' },
    { label: 'Volatility 75', value: 'R_75' },
    { label: 'Volatility 100', value: 'R_100' },
    { label: 'Volatility 10 (1s)', value: '1HZ10V' },
    { label: 'Volatility 25 (1s)', value: '1HZ25V' },
    { label: 'Volatility 50 (1s)', value: '1HZ50V' },
    { label: 'Volatility 75 (1s)', value: '1HZ75V' },
    { label: 'Volatility 100 (1s)', value: '1HZ100V' },
    { label: 'Jump 10', value: 'JD10' },
    { label: 'Jump 25', value: 'JD25' },
    { label: 'Jump 50', value: 'JD50' },
    { label: 'Jump 75', value: 'JD75' },
    { label: 'Jump 100', value: 'JD100' },
    { label: 'Boom 500', value: 'BOOM500' },
    { label: 'Crash 500', value: 'CRASH500' },
];

type MarketOption = {
    label: string;
    value: string;
    market?: string;
    submarket?: string;
    pipSize?: number;
    isOpen?: boolean;
};

const normalizeMarkets = (response: any): MarketOption[] => {
    const activeSymbols = Array.isArray(response?.active_symbols)
        ? response.active_symbols
        : Array.isArray(response)
            ? response
            : [];
    const seen = new Set<string>();
    return activeSymbols
        .map((item: any) => {
            const value = String(item?.symbol || item?.underlying_symbol || '').trim();
            if (!value || seen.has(value)) return null;
            seen.add(value);
            return {
                label: String(item?.display_name || item?.symbol || value),
                value,
                market: item?.market,
                submarket: item?.submarket,
                pipSize: Number.isFinite(Number(item?.pip_size)) ? Number(item.pip_size) : undefined,
                isOpen: item?.exchange_is_open !== false && Number(item?.exchange_is_open) !== 0 && !item?.is_trading_suspended,
            };
        })
        .filter(Boolean)
        .sort((a: MarketOption, b: MarketOption) => a.label.localeCompare(b.label));
};

const STRATEGIES = [
    { value: 'AUTO', label: 'Auto — All Contract Types', group: 'Auto' },
    { value: 'EVEN', label: 'Even', group: 'Parity' },
    { value: 'ODD', label: 'Odd', group: 'Parity' },
    { value: 'MATCHES', label: 'Matches', group: 'Digits' },
    { value: 'DIFFERS', label: 'Differs', group: 'Digits' },
    { value: 'OVER', label: 'Over', group: 'Barrier' },
    { value: 'UNDER', label: 'Under', group: 'Barrier' },
    { value: 'RISE', label: 'Rise', group: 'Direction' },
    { value: 'FALL', label: 'Fall', group: 'Direction' },
    { value: 'ONLY UPS', label: 'Only Ups', group: 'Direction' },
    { value: 'ONLY DOWNS', label: 'Only Downs', group: 'Direction' },
    { value: 'HIGH TICK', label: 'High Tick', group: 'Range' },
    { value: 'LOW TICK', label: 'Low Tick', group: 'Range' },
] as const;

const LOGIC_MODES = [
    { value: 'confluence', label: 'Multi-window confluence', note: '20T + 50T + 100T agree with baseline' },
    { value: 'pressure', label: 'Distribution pressure', note: 'Strong and weak digit groups create the edge' },
    { value: 'touch', label: 'Touch and retention', note: 'Range touches followed by directional retention' },
    { value: 'pattern', label: 'Pattern radar', note: 'Recent sequences must confirm the distribution' },
];

type StrategyValue = typeof STRATEGIES[number]['value'];
type ConcreteStrategy = Exclude<StrategyValue, 'AUTO'>;
type TickPoint = { quote: number; digit: number; epoch: number };
type Candidate = {
    score: number;
    label: string;
    contractType: string;
    symbol?: string;
    strategy?: ConcreteStrategy;
    barrier?: number;
    reason: string;
    confidence: string;
    touches: number;
    retention: number;
    entryDigit?: number;
    riskScore?: number;
};
type TradeRow = {
    id: string;
    time: string;
    strategy: string;
    contract: string;
    stake: number;
    profit: number;
    status: 'WIN' | 'LOSS' | 'OPEN';
};

const getDigit = (quote: number, pipSize: number) => {
    const fixed = Number(quote).toFixed(Math.max(0, pipSize));
    return Number(fixed.replace('.', '').slice(-1));
};

const countsFor = (points: TickPoint[], size: number) => {
    const slice = points.slice(-size);
    const counts = Array(10).fill(0);
    slice.forEach(point => {
        if (Number.isInteger(point.digit)) counts[point.digit] += 1;
    });
    return { counts, total: slice.length };
};

const percentagesFor = (points: TickPoint[], size: number) => {
    const { counts, total } = countsFor(points, size);
    return counts.map(count => total ? (count / total) * 100 : 0);
};

const directionPct = (points: TickPoint[], size: number, direction: 'up' | 'down') => {
    const slice = points.slice(-size);
    if (slice.length < 2) return 0;
    let matches = 0;
    for (let i = 1; i < slice.length; i += 1) {
        const move = slice[i].quote - slice[i - 1].quote;
        if ((direction === 'up' && move > 0) || (direction === 'down' && move < 0)) matches += 1;
    }
    return (matches / (slice.length - 1)) * 100;
};

const longestRun = <T,>(values: T[], matches?: (value: T) => boolean) => {
    let longest = 0;
    let current = 0;
    values.forEach(value => {
        if (!matches || matches(value)) {
            current += 1;
            longest = Math.max(longest, current);
        } else {
            current = 0;
        }
    });
    return longest;
};

const parityPatternMatches = (points: TickPoint[], strategy: StrategyValue) => {
    if (strategy !== 'EVEN' && strategy !== 'ODD') return false;
    const wantedEven = strategy === 'EVEN';
    const parity = points.slice(-4).map(point => point.digit % 2 === 0);
    const isWanted = (value: boolean) => value === wantedEven;
    const isOpposite = (value: boolean) => value !== wantedEven;
    const three = parity.slice(-3);
    const four = parity.slice(-4);
    return (
        (three.length === 3 && isOpposite(three[0]) && isOpposite(three[1]) && isWanted(three[2])) ||
        (four.length === 4 && isOpposite(four[0]) && isOpposite(four[1]) && isWanted(four[2]) && isWanted(four[3]))
    );
};

const lastDigitMatches = (strategy: StrategyValue, digit: number, barrier: number) => {
    switch (strategy) {
        case 'EVEN': return digit % 2 === 0;
        case 'ODD': return digit % 2 !== 0;
        case 'MATCHES': return digit === barrier;
        case 'DIFFERS': return digit !== barrier;
        case 'OVER': return digit > barrier;
        case 'UNDER': return digit < barrier;
        default: return false;
    }
};

const strategyContract = (strategy: StrategyValue) => ({
    EVEN: 'DIGITEVEN',
    ODD: 'DIGITODD',
    MATCHES: 'DIGITMATCH',
    DIFFERS: 'DIGITDIFF',
    OVER: 'DIGITOVER',
    UNDER: 'DIGITUNDER',
    RISE: 'CALL',
    FALL: 'PUT',
    'ONLY UPS': 'RUNHIGH',
    'ONLY DOWNS': 'RUNLOW',
    'HIGH TICK': 'TICKHIGH',
    'LOW TICK': 'TICKLOW',
}[strategy]);

const oppositeStrategy = (strategy: StrategyValue): StrategyValue | null => ({
    EVEN: 'ODD',
    ODD: 'EVEN',
    MATCHES: 'DIFFERS',
    DIFFERS: 'MATCHES',
    OVER: 'UNDER',
    UNDER: 'OVER',
    RISE: 'FALL',
    FALL: 'RISE',
    'ONLY UPS': 'ONLY DOWNS',
    'ONLY DOWNS': 'ONLY UPS',
    'HIGH TICK': 'LOW TICK',
    'LOW TICK': 'HIGH TICK',
}[strategy] || null);

const AUTO_STRATEGIES: ConcreteStrategy[] = [
    'OVER', 'UNDER', 'EVEN', 'ODD', 'MATCHES', 'DIFFERS',
    'RISE', 'FALL', 'ONLY UPS', 'ONLY DOWNS', 'HIGH TICK', 'LOW TICK',
];

type AutoRotationPlan = { strategy: ConcreteStrategy; barrier?: number };

// AUTO rotates through an explicit, bounded plan. This prevents the scanner
// from repeatedly choosing one contract while still testing every requested
// Over/Under barrier and the supported digit/direction contracts.
const AUTO_ROTATION_PLANS: AutoRotationPlan[] = [
    ...[4, 5, 6, 7, 8].map(barrier => ({ strategy: 'OVER' as ConcreteStrategy, barrier })),
    ...[4, 3, 2, 1].map(barrier => ({ strategy: 'UNDER' as ConcreteStrategy, barrier })),
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(barrier => ({ strategy: 'MATCHES' as ConcreteStrategy, barrier })),
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(barrier => ({ strategy: 'DIFFERS' as ConcreteStrategy, barrier })),
    { strategy: 'EVEN' },
    { strategy: 'ODD' },
    { strategy: 'RISE' },
    { strategy: 'FALL' },
    { strategy: 'ONLY UPS' },
    { strategy: 'ONLY DOWNS' },
    { strategy: 'HIGH TICK' },
    { strategy: 'LOW TICK' },
];

const chooseAutomaticBarrier = (points: TickPoint[], selectedStrategy: ConcreteStrategy, fallback: number, forcedBarrier?: number) => {
    if (!['OVER', 'UNDER', 'MATCHES', 'DIFFERS'].includes(selectedStrategy)) return undefined;
    if (forcedBarrier != null) return forcedBarrier;
    if (!points.length) return fallback;

    const p20 = percentagesFor(points, 20);
    if (selectedStrategy === 'MATCHES' || selectedStrategy === 'DIFFERS') {
        return p20.reduce((best, value, digit) => value > best.value ? { digit, value } : best, { digit: fallback, value: -1 }).digit;
    }

    let bestBarrier = fallback;
    let bestScore = -Infinity;
    for (let candidateBarrier = 1; candidateBarrier <= 8; candidateBarrier += 1) {
        const winningStrength = selectedStrategy === 'OVER'
            ? p20.slice(candidateBarrier + 1).reduce((sum, value) => sum + value, 0)
            : p20.slice(0, candidateBarrier).reduce((sum, value) => sum + value, 0);
        const losingTouches = selectedStrategy === 'OVER'
            ? points.slice(-20).filter(point => point.digit <= candidateBarrier).length
            : points.slice(-20).filter(point => point.digit >= candidateBarrier).length;
        const score = winningStrength + (losingTouches >= 2 && losingTouches <= 6 ? 12 : 0);
        if (score > bestScore) {
            bestScore = score;
            bestBarrier = candidateBarrier;
        }
    }
    return bestBarrier;
};

const evaluateCandidate = (candidate: Candidate, strategy: StrategyValue, point: TickPoint, previous?: TickPoint) => {
    const contractType = String(candidate.contractType || strategyContract(strategy)).toUpperCase();
    if (contractType === 'CALL' || contractType === 'RUNHIGH') return Boolean(previous && point.quote > previous.quote);
    if (contractType === 'PUT' || contractType === 'RUNLOW') return Boolean(previous && point.quote < previous.quote);
    if (contractType === 'TICKHIGH') return Boolean(previous && point.quote >= previous.quote);
    if (contractType === 'TICKLOW') return Boolean(previous && point.quote <= previous.quote);

    const contractStrategy: StrategyValue = ({
        DIGITEVEN: 'EVEN',
        DIGITODD: 'ODD',
        DIGITMATCH: 'MATCHES',
        DIGITDIFF: 'DIFFERS',
        DIGITOVER: 'OVER',
        DIGITUNDER: 'UNDER',
    } as Record<string, StrategyValue>)[contractType] || strategy;
    return lastDigitMatches(contractStrategy, point.digit, candidate.barrier ?? 5);
};

const formatTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const AutoDigits = observer(() => {
    const { connected, authorized, balance, currency, send, subscribeTicks, buyContract } = useDerivTrade();
    const [markets, setMarkets] = useState<MarketOption[]>(FALLBACK_MARKETS);
    const [marketSelection, setMarketSelection] = useState('1HZ100V');
    const [symbol, setSymbol] = useState('1HZ100V');
    const [strategy, setStrategy] = useState<StrategyValue>('AUTO');
    const [logicMode, setLogicMode] = useState('confluence');
    const [minScore, setMinScore] = useState(70);
    const [stake, setStake] = useState('1.00');
    const [duration, setDuration] = useState(2);
    const [autoDuration, setAutoDuration] = useState(true);
    const [run, setRun] = useState(false);
    const [pipSize, setPipSize] = useState(2);
    const [points, setPoints] = useState<TickPoint[]>([]);
    const [currentDigit, setCurrentDigit] = useState<number | null>(null);
    const [currentPrice, setCurrentPrice] = useState('');
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [status, setStatus] = useState('Collecting market data');
    const [log, setLog] = useState<string[]>(['Engine ready — waiting for 1,000-tick baseline']);
    const [trades, setTrades] = useState<TradeRow[]>([]);
    const [pnl, setPnl] = useState(0);
    const [wins, setWins] = useState(0);
    const [losses, setLosses] = useState(0);
    const [lossStreak, setLossStreak] = useState(0);
    const [recoveryDeficit, setRecoveryDeficit] = useState(0);
    const [validation, setValidation] = useState({ wins: 0, attempt: 0, state: 'IDLE' });
    const [displayCur, setDisplayCur] = useState(getDisplayCurrency());
    const [takeProfit, setTakeProfit] = useState('5.00');
    const [maxSessionLoss, setMaxSessionLoss] = useState('5.00');
    const [reservePercent, setReservePercent] = useState(30);
    const [maxStakePercent, setMaxStakePercent] = useState(5);
    const [autoStakeEnabled, setAutoStakeEnabled] = useState(true);
    const [bestMartingale, setBestMartingale] = useState(1.45);
    const [completedRuns, setCompletedRuns] = useState(0);

    const marketPointsRef = useRef<Record<string, TickPoint[]>>({});
    const rawHistoryByMarketRef = useRef<Record<string, number[]>>({});
    const marketPipRefs = useRef<Record<string, number>>({});
    const marketCandidatesRef = useRef<Record<string, Candidate>>({});
    const activeSymbolRef = useRef('1HZ100V');
    const mountedRef = useRef(true);
    const activeRef = useRef(false);
    const runningRef = useRef(false);
    const realInFlightRef = useRef(false);
    const validationRef = useRef({ key: '', wins: 0, attempt: 0, readyEpoch: 0 });
    const stakeRef = useRef(1);
    const lossStreakRef = useRef(0);
    const nextIdRef = useRef(0);
    const lastCandidateRef = useRef<Candidate | null>(null);
    const pnlRef = useRef(0);
    const recoveryBaselineRef = useRef<number | null>(null);
    const recoveryDeficitRef = useRef(0);
    const tradePnlBeforeRef = useRef(0);
    const balancedTradeRef = useRef(false);
    const recentResultsRef = useRef<Array<'W' | 'L'>>([]);
    const marketSelectionRef = useRef('1HZ100V');
    const marketsRef = useRef<MarketOption[]>(FALLBACK_MARKETS);
    const autoRotationIndexRef = useRef(0);
    const recoveryStakeRef = useRef(1);
    const completedRunsRef = useRef(0);
    const balanceRef = useRef<number | null>(null);
    const sessionStartBalanceRef = useRef<number | null>(null);
    const lastRecoverySkipRef = useRef('');

    useEffect(() => subscribeCurrency(() => setDisplayCur(getDisplayCurrency())), []);
    useEffect(() => { balanceRef.current = balance == null ? null : Number(balance); }, [balance]);
    useEffect(() => {
        marketSelectionRef.current = marketSelection;
        marketCandidatesRef.current = {};
        lastCandidateRef.current = null;
        validationRef.current = { key: '', wins: 0, attempt: 0, readyEpoch: 0 };
        autoRotationIndexRef.current = 0;
        setCandidate(null);
        setValidation({ wins: 0, attempt: 0, state: 'IDLE' });
        setStatus(marketSelection === 'ALL' ? 'Re-scanning all available markets' : 'Re-scanning selected market');
    }, [marketSelection]);
    useEffect(() => {
        stakeRef.current = Math.max(0.35, Number(stake) || 0.35);
    }, [stake]);
    useEffect(() => {
        // A changed contract type or entry logic must not reuse a candidate
        // calculated under the previous selection while the next market tick
        // arrives. Clear both the ranked market candidates and virtual gate.
        marketCandidatesRef.current = {};
        lastCandidateRef.current = null;
        validationRef.current = { key: '', wins: 0, attempt: 0, readyEpoch: 0 };
        autoRotationIndexRef.current = 0;
        setCandidate(null);
        setValidation({ wins: 0, attempt: 0, state: 'IDLE' });
        setStatus('Re-scanning selected contract conditions');
    }, [logicMode, minScore, strategy]);

    const addLog = useCallback((message: string) => {
        setLog(previous => [`${formatTime()}  ${message}`, ...previous].slice(0, 18));
    }, []);

    const marketLabel = useCallback((marketSymbol: string) =>
        marketsRef.current.find(market => market.value === marketSymbol)?.label || marketSymbol, []);

    const analyzeStrategy = useCallback((nextPoints: TickPoint[], analysisStrategy: ConcreteStrategy, autoMode = false, forcedBarrier?: number): Candidate => {
        const p1000 = percentagesFor(nextPoints, 1000);
        const p100 = percentagesFor(nextPoints, 100);
        const p50 = percentagesFor(nextPoints, 50);
        const p20 = percentagesFor(nextPoints, 20);
        const last10 = nextPoints.slice(-10);
        const last20 = nextPoints.slice(-20);
        const barrierNumber = Math.max(
            0,
            Math.min(
                9,
                Number(strategy === 'AUTO'
                    ? chooseAutomaticBarrier(nextPoints, analysisStrategy, 3, forcedBarrier)
                    : chooseAutomaticBarrier(nextPoints, analysisStrategy, 3, forcedBarrier)) || 0
            )
        );
        const recentCounts = countsFor(nextPoints, 20).counts;
        const recentDominant = recentCounts.reduce((best, count, digit) => count > best.count ? { digit, count } : best, { digit: 0, count: 0 });
        const recurrence = recentDominant.count;
        const digitCluster = longestRun(last20.map(point => point.digit), digit => digit === recentDominant.digit);
        const parityPattern = parityPatternMatches(nextPoints, analysisStrategy);
        const odd1000 = p1000.filter((_, index) => index % 2 !== 0).reduce((a, b) => a + b, 0);
        const even1000 = 100 - odd1000;
        const balancedParity = Math.abs(odd1000 - even1000) <= 4;
        let score = 35;
        let reason = 'Waiting for enough confirmation';
        let touches = 0;
        let retention = 0;
        let entryDigit: number | undefined;

        if (nextPoints.length < 20) {
            return { score: 0, strategy: analysisStrategy, label: 'WARMING UP', contractType: strategyContract(analysisStrategy), reason: 'Collecting the 20-tick entry window', confidence: 'DATA', touches, retention };
        }

        if (nextPoints.length < 1000) {
            return { score: 0, strategy: analysisStrategy, label: 'BUILDING BASELINE', contractType: strategyContract(analysisStrategy), reason: `Collecting the 1,000-tick baseline (${nextPoints.length}/1,000)`, confidence: 'DATA', touches, retention };
        }

        const odd100 = p100.filter((_, index) => index % 2 !== 0).reduce((a, b) => a + b, 0);
        const even100 = 100 - odd100;
        const parity = analysisStrategy === 'ODD' ? odd100 : even100;
        const parityIncreasing = analysisStrategy === 'ODD'
            ? odd100 >= (p50.filter((_, index) => index % 2 !== 0).reduce((a, b) => a + b, 0)) - 0.5
            : even100 >= (p50.filter((_, index) => index % 2 === 0).reduce((a, b) => a + b, 0)) - 0.5;

        if (analysisStrategy === 'ODD' || analysisStrategy === 'EVEN') {
            const wanted = analysisStrategy === 'ODD' ? [1, 3, 5, 7, 9] : [0, 2, 4, 6, 8];
            const opposite = analysisStrategy === 'ODD' ? [0, 2, 4, 6, 8] : [1, 3, 5, 7, 9];
            const strong = wanted.filter(d => p1000[d] >= 10.5).length;
            const weak = opposite.filter(d => p1000[d] < 10.4).length;
            score = Math.min(100, 30 + (parity >= 55 ? 25 : Math.max(0, parity - 45)) + strong * 5 + weak * 3 + (parityIncreasing ? 8 : 0) + (parityPattern ? 8 : 0));
            reason = `${strong} strong ${analysisStrategy.toLowerCase()} digits, ${weak} weak opposite digits; ${parity.toFixed(1)}% parity pressure; ${parityPattern ? 'sequence confirmed' : 'sequence waiting'}`;
            entryDigit = opposite.sort((a, b) => p1000[a] - p1000[b])[0];
            if (balancedParity && !parityPattern) score = Math.min(score, 59);
        } else if (analysisStrategy === 'MATCHES' || analysisStrategy === 'DIFFERS') {
            const sorted = p1000.map((value, digit) => ({ digit, value })).sort((a, b) => b.value - a.value);
            const dominant = sorted[0];
            const selectedDigit = forcedBarrier != null ? forcedBarrier : dominant.digit;
            const selectedFrequency = p1000[selectedDigit] ?? 0;
            const diversity = p20.filter(value => value > 0).length;
            const concentrationRising = p20[selectedDigit] >= p50[selectedDigit] && p50[selectedDigit] >= p100[selectedDigit];
            entryDigit = selectedDigit;
            score = analysisStrategy === 'MATCHES'
                ? Math.min(100, 34 + selectedFrequency * 2 + (concentrationRising ? 18 : 0) + (p20[selectedDigit] > 12 ? 10 : 0) + Math.min(10, recurrence * 1.5) + Math.min(8, digitCluster * 2))
                : Math.min(100, 34 + diversity * 4 + (selectedFrequency < 14 ? 16 : 0) + (p20.filter(value => value > 0).length >= 8 ? 8 : 0) + Math.max(0, 10 - recurrence) + Math.max(0, 8 - digitCluster * 2));
            reason = analysisStrategy === 'MATCHES'
                ? `Digit ${selectedDigit} concentration is ${selectedFrequency.toFixed(1)}% with ${concentrationRising ? 'rising' : 'mixed'} short windows; recurrence ${recurrence}/20, cluster ${digitCluster}`
                : `${diversity}/10 digits active; barrier ${selectedDigit}; recurrence ${recurrence}/20, cluster ${digitCluster}; dispersion ${selectedFrequency < 14 ? 'healthy' : 'too concentrated'}`;
        } else if (analysisStrategy === 'OVER' || analysisStrategy === 'UNDER') {
            const losing = analysisStrategy === 'OVER'
                ? last10.filter(point => point.digit <= barrierNumber)
                : last10.filter(point => point.digit >= barrierNumber);
            touches = losing.length;
            const winning = analysisStrategy === 'OVER'
                ? last20.filter(point => point.digit > barrierNumber)
                : last20.filter(point => point.digit < barrierNumber);
            const winningRun = longestRun(last20.slice().reverse(), point => analysisStrategy === 'OVER' ? point.digit > barrierNumber : point.digit < barrierNumber);
            retention = Math.min(100, winningRun * 25 + winning.length * 2);
            const losingRate = analysisStrategy === 'OVER'
                ? p1000.slice(0, barrierNumber + 1).reduce((a, b) => a + b, 0)
                : p1000.slice(barrierNumber, 10).reduce((a, b) => a + b, 0);
            const winningStrength = analysisStrategy === 'OVER'
                ? p20.slice(barrierNumber + 1).reduce((a, b) => a + b, 0)
                : p20.slice(0, barrierNumber).reduce((a, b) => a + b, 0);
            score = Math.min(100, 28 + (touches >= 2 && touches <= 5 ? 22 : 0) + (retention >= 50 ? 20 : retention / 3) + (losingRate < 55 ? 18 : 0) + (winningStrength >= 55 ? 12 : 0) + (p20.filter((value, digit) => analysisStrategy === 'OVER' ? digit > barrierNumber && value >= 10 : digit < barrierNumber && value >= 10).length * 3));
            reason = `${touches}/10 losing-region touches; ${retention}% retention; ${winningStrength.toFixed(0)}% winning-side strength`;
            entryDigit = analysisStrategy === 'OVER'
                ? p20.map((value, digit) => ({ value, digit })).filter(item => item.digit > barrierNumber).sort((a, b) => b.value - a.value)[0]?.digit
                : p20.map((value, digit) => ({ value, digit })).filter(item => item.digit < barrierNumber).sort((a, b) => b.value - a.value)[0]?.digit;
        } else if (analysisStrategy === 'RISE' || analysisStrategy === 'FALL' || analysisStrategy === 'ONLY UPS' || analysisStrategy === 'ONLY DOWNS') {
            const direction = analysisStrategy === 'RISE' || analysisStrategy === 'ONLY UPS' ? 'up' : 'down';
            const d20 = directionPct(nextPoints, 20, direction);
            const d50 = directionPct(nextPoints, 50, direction);
            const d100 = directionPct(nextPoints, 100, direction);
            const d1000 = directionPct(nextPoints, 1000, direction);
            const strict = analysisStrategy === 'ONLY UPS' || analysisStrategy === 'ONLY DOWNS';
            let consecutive = 0;
            for (let index = nextPoints.length - 1; index > 0; index -= 1) {
                const move = nextPoints[index].quote - nextPoints[index - 1].quote;
                if ((direction === 'up' && move > 0) || (direction === 'down' && move < 0)) consecutive += 1;
                else break;
            }
            const chop = Math.min(d20, 100 - d20);
            score = Math.min(100, 25 + (d20 >= (strict ? 65 : 55) ? 26 : 0) + (d50 >= 55 ? 18 : 0) + (d100 >= 53 ? 12 : 0) + (d1000 >= 50 ? 7 : 0) + Math.min(12, consecutive * 3) - (strict && chop > 42 ? 12 : 0));
            reason = `${direction.toUpperCase()} pressure: ${d20.toFixed(0)}% / ${d50.toFixed(0)}% / ${d100.toFixed(0)}% / ${d1000.toFixed(0)}% across 20T–1,000T`;
            retention = Math.min(100, consecutive * 20);
        } else {
            const window = nextPoints.slice(-50);
            const quotes = window.map(point => point.quote);
            const low = Math.min(...quotes);
            const high = Math.max(...quotes);
            const current = quotes[quotes.length - 1] || 0;
            const rangePosition = high === low ? 50 : ((current - low) / (high - low)) * 100;
            const isHigh = analysisStrategy === 'HIGH TICK';
            const rangeDirection = isHigh ? 'up' : 'down';
            const shortMomentum = directionPct(nextPoints, 20, rangeDirection);
            const baselineMomentum = directionPct(nextPoints, 1000, rangeDirection);
            score = Math.min(100, 35 + (isHigh ? rangePosition : 100 - rangePosition) * 0.55 + (shortMomentum >= 55 ? 15 : 0) + (baselineMomentum >= 50 ? 5 : 0));
            reason = `${isHigh ? 'High' : 'Low'} range position ${rangePosition.toFixed(0)}% with ${shortMomentum.toFixed(0)}% short / ${baselineMomentum.toFixed(0)}% baseline momentum`;
            retention = isHigh ? rangePosition : 100 - rangePosition;
        }

        if (logicMode === 'confluence') {
            const parityWindowsAgree = analysisStrategy === 'ODD'
                ? odd100 >= even100 && odd1000 >= even1000
                : analysisStrategy === 'EVEN'
                    ? even100 >= odd100 && even1000 >= odd1000
                    : true;
            score += parityWindowsAgree ? 6 : 0;
        }
        if (logicMode === 'pressure' && p1000.length) score += Math.min(6, Math.abs(odd1000 - even1000) / 3);
        if (logicMode === 'touch' && touches >= 2) score += Math.min(8, touches);
        if (logicMode === 'pattern') {
            score += parityPattern ? 8 : 0;
            if ((analysisStrategy === 'ODD' || analysisStrategy === 'EVEN') && !parityPattern) score = Math.min(score, 69);
        }
        // Keep recovery candidates available after a few losses, but make the
        // engine fail closed after a sustained loss cluster. The execution
        // gate below still limits recovery to higher-confidence contract types.
        const riskScore = lossStreakRef.current >= 6
            ? 0
            : recoveryDeficitRef.current > 0
                ? 8
                : 5;
        score += riskScore;
        if (!riskScore) score = 0;
        score = Math.round(Math.min(100, score));
        const confidence = score >= 90 ? 'VERY STRONG' : score >= 80 ? 'STRONG' : score >= minScore ? 'WATCH' : 'WAIT';
        return {
            score,
            strategy: analysisStrategy,
            label: `${analysisStrategy}${entryDigit !== undefined ? ` ${entryDigit}` : ''}${autoMode ? ' · AUTO' : ''}`,
            contractType: strategyContract(analysisStrategy),
            barrier: analysisStrategy === 'MATCHES'
                ? (entryDigit ?? barrierNumber)
                : ['OVER', 'UNDER', 'DIFFERS'].includes(analysisStrategy) ? barrierNumber : undefined,
            reason,
            confidence,
            touches,
            retention,
            entryDigit,
            riskScore,
        };
    }, [logicMode, minScore]);

    const analyze = useCallback((nextPoints: TickPoint[]): Candidate => {
        const strategies = strategy === 'AUTO' ? AUTO_STRATEGIES : [strategy];
        const candidates = strategies.map(analysisStrategy =>
            analyzeStrategy(nextPoints, analysisStrategy as ConcreteStrategy, strategy === 'AUTO')
        );
        const qualified = candidates.filter(item => item.score >= minScore);
        return [...(qualified.length ? qualified : candidates)]
            .sort((a, b) => b.score - a.score)[0] || analyzeStrategy(nextPoints, 'OVER', strategy === 'AUTO');
    }, [analyzeStrategy, minScore, strategy]);

    const processPoint = useCallback((marketSymbol: string, point: TickPoint) => {
        const previousPoints = marketPointsRef.current[marketSymbol] || [];
        const previous = previousPoints[previousPoints.length - 1];
        const nextPoints = [...previousPoints, point].slice(-1000);
        marketPointsRef.current[marketSymbol] = nextPoints;

        const nextCandidate = { ...analyze(nextPoints), symbol: marketSymbol };
        marketCandidatesRef.current[marketSymbol] = nextCandidate;
        const bestCandidate = Object.values(marketCandidatesRef.current)
            .sort((a, b) => b.score - a.score)[0] || nextCandidate;
        const isActiveMarket = bestCandidate.symbol === marketSymbol;
        const rotationPlan = strategy === 'AUTO'
            ? AUTO_ROTATION_PLANS[autoRotationIndexRef.current % AUTO_ROTATION_PLANS.length]
            : undefined;
        const executionCandidate = rotationPlan
            ? {
                ...analyzeStrategy(nextPoints, rotationPlan.strategy, true, rotationPlan.barrier),
                symbol: marketSymbol,
            }
            : bestCandidate;
        if (isActiveMarket || !lastCandidateRef.current) {
            const previousActiveSymbol = activeSymbolRef.current;
            activeSymbolRef.current = bestCandidate.symbol || marketSymbol;
            if (bestCandidate.symbol && bestCandidate.symbol !== previousActiveSymbol) setSymbol(bestCandidate.symbol);
            const activePoints = marketPointsRef.current[bestCandidate.symbol || marketSymbol] || nextPoints;
            setPoints(activePoints);
            setPipSize(marketPipRefs.current[bestCandidate.symbol || marketSymbol] || 2);
            setCurrentDigit(activePoints[activePoints.length - 1]?.digit ?? null);
            setCurrentPrice(activePoints[activePoints.length - 1]?.quote.toFixed(marketPipRefs.current[bestCandidate.symbol || marketSymbol] || 2) || '');
            lastCandidateRef.current = bestCandidate;
            setCandidate(executionCandidate);
        }

        if (!isActiveMarket || !runningRef.current || realInFlightRef.current || executionCandidate.score < minScore) return;
        if (!authorized) {
            setStatus('Login required before real execution');
            return;
        }

        const executionStrategy: ConcreteStrategy = executionCandidate.strategy || (strategy === 'AUTO' ? 'OVER' : strategy);
        const selectedContractType = String(executionCandidate.contractType || strategyContract(executionStrategy)).toUpperCase();
        const candidateKey = `${executionCandidate.symbol}:${selectedContractType}:${executionCandidate.barrier ?? 'none'}`;
        const recoverySafeTypes = new Set(['DIGITEVEN', 'DIGITODD', 'DIGITMATCH', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER', 'CALL', 'PUT']);
        const inRecovery = recoveryDeficitRef.current > 0 || lossStreakRef.current > 0;
        if (inRecovery && (!recoverySafeTypes.has(selectedContractType) || executionCandidate.score < Math.max(minScore, 78))) {
            const skippedPlan = executionCandidate.label;
            if (lastRecoverySkipRef.current !== skippedPlan) {
                lastRecoverySkipRef.current = skippedPlan;
                addLog(`RECOVERY SKIP — ${skippedPlan} did not meet the score/risk gate`);
            }
            if (rotationPlan) {
                autoRotationIndexRef.current = (autoRotationIndexRef.current + 1) % AUTO_ROTATION_PLANS.length;
                validationRef.current = { key: '', wins: 0, attempt: 0, readyEpoch: point.epoch };
            }
            setStatus('RECOVERY FILTER — waiting for a qualified, lower-risk contract');
            return;
        }
        const validationState = validationRef.current;
        if (!validationState.key || validationState.key !== candidateKey) {
            validationRef.current = { key: candidateKey, wins: 0, attempt: 1, readyEpoch: point.epoch };
            setValidation({ wins: 0, attempt: 1, state: 'VIRTUAL 1' });
            setStatus('Validating signal virtually');
            addLog(`VIRTUAL 1 queued — ${executionCandidate.label} on ${marketLabel(executionCandidate.symbol || '')} scored ${executionCandidate.score}/100`);
            return;
        }
        if (point.epoch <= validationState.readyEpoch) return;

        // Do not buy merely because the score passed the threshold. The live
        // tick must satisfy the selected contract's condition using the
        // barrier chosen for this market.
        const virtualWon = evaluateCandidate({ ...bestCandidate, contractType: selectedContractType }, executionStrategy, point, previous);
        if (!virtualWon) {
            validationRef.current = { key: '', wins: 0, attempt: validationState.attempt + 1, readyEpoch: point.epoch };
            setValidation({ wins: 0, attempt: validationState.attempt + 1, state: 'RESET' });
            setStatus('Virtual check rejected — re-scanning');
            addLog('VIRTUAL LOSS — candidate rejected; waiting for a clean setup');
            return;
        }

        const nextVirtualWins = validationState.wins + 1;
        if (nextVirtualWins < 2) {
            validationRef.current = { ...validationState, wins: nextVirtualWins, readyEpoch: point.epoch };
            setValidation({ wins: nextVirtualWins, attempt: validationState.attempt, state: 'VIRTUAL 2' });
            addLog(`VIRTUAL ${nextVirtualWins} WIN — one more confirmation required`);
            return;
        }

        validationRef.current = { key: '', wins: 0, attempt: validationState.attempt, readyEpoch: point.epoch };
        setValidation({ wins: 2, attempt: validationState.attempt, state: 'PASSED' });
        setStatus('Validation passed — sending contract');
        const recentOutcomes = recentResultsRef.current.slice(-4).join('');
        const isAlternatingOutcomes = recentOutcomes === 'WLWL' || recentOutcomes === 'LWLW';
        const tradeDuration = autoDuration
            ? (isAlternatingOutcomes
                ? 2
                : Math.max(1, Math.min(5, executionCandidate.score >= 90 ? 1 : executionCandidate.score >= 82 ? 2 : executionCandidate.score >= 74 ? 3 : 4)))
            : duration;
        const baseStake = stakeRef.current;
        const currentBalance = balanceRef.current;
        if (!Number.isFinite(currentBalance) || currentBalance == null || currentBalance <= 0) {
            runningRef.current = false;
            setRun(false);
            setStatus('BALANCE CHECK — execution paused until the account balance is available');
            addLog('RISK STOP — account balance unavailable; no contract sent');
            return;
        }
        const reserve = Math.max(10, Math.min(90, Number(reservePercent) || 30));
        const stakeLimitPercent = Math.max(1, Math.min(25, Number(maxStakePercent) || 5));
        const sessionLossLimit = Math.max(0.35, Number(maxSessionLoss) || 5);
        const configuredTarget = Math.max(0.01, Number(takeProfit) || 5);
        const balanceFloor = currentBalance * (reserve / 100);
        const sessionFloor = sessionStartBalanceRef.current == null
            ? balanceFloor
            : sessionStartBalanceRef.current * (reserve / 100);
        if (currentBalance <= sessionFloor) {
            runningRef.current = false;
            setRun(false);
            setStatus('RESERVE STOP — the protected account balance floor was reached');
            addLog(`RISK STOP — reserve floor ${fromUsd(sessionFloor).toFixed(2)} ${displayCur} reached`);
            return;
        }
        const availableRisk = Math.min(currentBalance - balanceFloor, sessionLossLimit);
        const maxStake = Math.min(currentBalance * (stakeLimitPercent / 100), availableRisk);
        const autoStakeActive = autoStakeEnabled && completedRunsRef.current >= 5;
        const requestedStake = autoStakeActive ? recoveryStakeRef.current : baseStake;
        if (maxStake < 0.35) {
            runningRef.current = false;
            setRun(false);
            setStatus('RISK STOP — safe stake is below the Deriv minimum');
            addLog('RISK STOP — account reserve and session-loss limits allow no new contract');
            return;
        }
        const contractStake = Math.max(0.35, Math.min(requestedStake, maxStake));
        const targetProgress = Math.max(0, Math.min(1, pnlRef.current / configuredTarget));
        const goalFactor = targetProgress >= 0.75 ? 0.65 : targetProgress >= 0.5 ? 0.8 : 1;
        const goalAdjustedStake = autoStakeActive
            ? Math.max(baseStake, +(requestedStake * goalFactor).toFixed(2))
            : contractStake;
        const safeContractStake = Math.max(0.35, Math.min(goalAdjustedStake, maxStake));
        tradePnlBeforeRef.current = pnlRef.current;
        const currentOddPressure = percentagesFor(marketPointsRef.current[executionCandidate.symbol || activeSymbolRef.current] || [], 100)
            .filter((_, index) => index % 2 !== 0)
            .reduce((a, b) => a + b, 0);
        const currentEvenPressure = 100 - currentOddPressure;
        balancedTradeRef.current = (executionStrategy === 'EVEN' || executionStrategy === 'ODD') && Math.abs(currentOddPressure - currentEvenPressure) <= 4;
        realInFlightRef.current = true;
        const rowId = `ad-${Date.now()}-${++nextIdRef.current}`;
        setTrades(previousTrades => [{ id: rowId, time: formatTime(), strategy: executionCandidate.label, contract: executionCandidate.contractType, stake: safeContractStake, profit: 0, status: 'OPEN' }, ...previousTrades].slice(0, 30));
        setTradeContext({ page: 'Auto-Digits', bot: executionCandidate.label });
        if (safeContractStake < requestedStake) addLog(`STAKE CONTROLLED — ${requestedStake.toFixed(2)} → ${safeContractStake.toFixed(2)} ${displayCur} by goal/risk limits`);
        addLog(`EXECUTE — ${executionCandidate.contractType} ${executionCandidate.barrier ?? ''} on ${marketLabel(executionCandidate.symbol || '')} | ${safeContractStake.toFixed(2)} ${displayCur} | ${tradeDuration}T`);
        if (rotationPlan) autoRotationIndexRef.current = (autoRotationIndexRef.current + 1) % AUTO_ROTATION_PLANS.length;
        buyContract({
            symbol: executionCandidate.symbol || activeSymbolRef.current,
            contract_type: executionCandidate.contractType,
            duration: tradeDuration,
            duration_unit: 't',
            stake: safeContractStake,
            barrier: executionCandidate.barrier,
            currency,
            metadata: {
                auto_digits: true,
                source: 'auto-digits',
                execution_mode: 'market-condition-scanner',
                strategy: executionCandidate.label,
                validation: '2 virtual wins',
                selected_by: rotationPlan ? 'safe-contract-rotation' : 'market-condition-scanner',
                batch_id: `AUTO-DIGITS-${Date.now()}`,
            },
        }, settled => {
            realInFlightRef.current = false;
            const won = settled.status === 'won';
            const profit = Number(settled.profit || 0);
            setTrades(previousTrades => previousTrades.map(trade => trade.id === rowId ? { ...trade, profit, status: won ? 'WIN' : 'LOSS' } : trade));
            const nextPnl = pnlRef.current + profit;
            pnlRef.current = nextPnl;
            setPnl(nextPnl);
            const settledRuns = completedRunsRef.current + 1;
            completedRunsRef.current = settledRuns;
            setCompletedRuns(settledRuns);
            const autoStakeActive = autoStakeEnabled && settledRuns >= 5;
            recentResultsRef.current = [...recentResultsRef.current, won ? 'W' : 'L'].slice(-8);
            if (won) {
                lossStreakRef.current = 0;
                setLossStreak(0);
                setWins(previousWins => previousWins + 1);
                const baseline = recoveryBaselineRef.current;
                const recovered = baseline == null || nextPnl >= baseline;
                if (recovered) {
                    recoveryBaselineRef.current = null;
                    recoveryDeficitRef.current = 0;
                    setRecoveryDeficit(0);
                    recoveryStakeRef.current = stakeRef.current;
                } else {
                    const remaining = Math.max(0, baseline - nextPnl);
                    recoveryDeficitRef.current = remaining;
                    setRecoveryDeficit(remaining);
                    // A recovery win reduces the next stake toward the manual
                    // base instead of keeping the peak martingale amount.
                    recoveryStakeRef.current = Math.max(
                        stakeRef.current,
                        +(safeContractStake * 0.7).toFixed(2),
                    );
                }
                if (balancedTradeRef.current) {
                    runningRef.current = false;
                    setRun(false);
                    setStatus('BALANCED PARITY WIN — engine stopped after one qualified win');
                } else {
                    setStatus(recovered ? 'WIN — recovery cleared; scanning next setup' : 'WIN — partial recovery; revalidating');
                }
                addLog(`WIN +${profit.toFixed(2)} ${displayCur} — ${recovered ? 'recovery cleared' : 'partial recovery retained'}`);
            } else {
                const nextLosses = lossStreakRef.current + 1;
                lossStreakRef.current = nextLosses;
                setLossStreak(nextLosses);
                setLosses(previousLosses => previousLosses + 1);
                const baseline = recoveryBaselineRef.current ?? tradePnlBeforeRef.current;
                recoveryBaselineRef.current = baseline;
                const nextDeficit = Math.max(0, baseline - nextPnl);
                recoveryDeficitRef.current = nextDeficit;
                setRecoveryDeficit(nextDeficit);
                recoveryStakeRef.current = autoStakeActive
                    ? Math.max(stakeRef.current, +(safeContractStake * bestMartingale).toFixed(2))
                    : stakeRef.current;
                if (nextLosses >= 3) {
                    const opposite = oppositeStrategy(executionStrategy);
                    if (opposite && strategy !== 'AUTO') {
                        setStrategy(opposite);
                        addLog(`LOSS ${profit.toFixed(2)} ${displayCur} — 3-loss re-scan: ${opposite}, next market, and adaptive duration`);
                    } else {
                        addLog(`LOSS ${profit.toFixed(2)} ${displayCur} — auto re-scan: contract type, barrier, market, and duration`);
                    }
                    validationRef.current = { key: '', wins: 0, attempt: validationState.attempt + 1, readyEpoch: point.epoch };
                } else {
                    addLog(`LOSS ${profit.toFixed(2)} ${displayCur} — revalidate before controlled recovery`);
                }
                setStatus(nextLosses >= 3 ? 'Loss cluster — windows, market, and duration re-scan' : `LOSS — controlled recovery: ${fromUsd(nextDeficit).toFixed(2)} ${displayCur} at risk`);
            }
            // Refresh the authoritative account balance after every settlement
            // so the next entry applies the reserve and stake-percentage caps.
            void send({ balance: 1 }).catch(() => {});
            const target = Math.max(0.01, Number(takeProfit) || 5);
            const lossLimit = Math.max(0.35, Number(maxSessionLoss) || 5);
            if (nextPnl >= target) {
                runningRef.current = false;
                setRun(false);
                setStatus(`TAKE PROFIT HIT — ${fromUsd(nextPnl).toFixed(2)} ${displayCur}; trading stopped`);
                addLog(`TAKE PROFIT HIT — target ${fromUsd(target).toFixed(2)} ${displayCur} reached`);
            } else if (nextPnl <= -lossLimit) {
                runningRef.current = false;
                setRun(false);
                setStatus(`SESSION LOSS LIMIT — ${fromUsd(lossLimit).toFixed(2)} ${displayCur}; trading stopped`);
                addLog(`RISK STOP — session loss limit ${fromUsd(lossLimit).toFixed(2)} ${displayCur} reached`);
            }
        }).catch(error => {
            realInFlightRef.current = false;
            validationRef.current = { key: '', wins: 0, attempt: 0, readyEpoch: point.epoch };
            setTrades(previousTrades => previousTrades.filter(trade => trade.id !== rowId));
            setStatus(error?.message || 'Trade request failed');
            addLog(`TRADE ERROR — ${error?.message || 'request rejected'}`);
        });
    }, [addLog, analyze, analyzeStrategy, authorized, autoDuration, autoStakeEnabled, bestMartingale, buyContract, currency, displayCur, duration, marketLabel, maxSessionLoss, minScore, reservePercent, send, strategy, takeProfit, maxStakePercent]);

    useEffect(() => {
        mountedRef.current = true;
        activeRef.current = true;
        if (!connected) {
            setStatus('Waiting for Deriv market connection');
            return () => {
                activeRef.current = false;
                mountedRef.current = false;
            };
        }
        marketPointsRef.current = {};
        rawHistoryByMarketRef.current = {};
        marketPipRefs.current = {};
        marketCandidatesRef.current = {};
        activeSymbolRef.current = marketSelectionRef.current === 'ALL' ? '1HZ100V' : marketSelectionRef.current;
        setSymbol(activeSymbolRef.current);
        setPoints([]);
        setCurrentDigit(null);
        setCurrentPrice('');
        setCandidate(null);
        setPipSize(2);
        setStatus('Loading authenticated market baselines');
        validationRef.current = { key: '', wins: 0, attempt: 0, readyEpoch: 0 };
        setValidation({ wins: 0, attempt: 0, state: 'IDLE' });
        const unsubscribers: Array<() => void> = [];

        const start = async () => {
            try {
                // The current Deriv options WebSocket rejects `product_type` on
                // active_symbols requests. The full response already contains
                // the symbols needed by the scanner, including synthetic
                // markets, so keep this request compatible with both public
                // and authenticated sessions.
                const activeSymbolsResponse = await send({ active_symbols: 'full' });
                if (activeSymbolsResponse?.error) {
                    throw new Error(activeSymbolsResponse.error.message || 'Deriv active-symbols request failed');
                }
                const discoveredMarkets = normalizeMarkets(activeSymbolsResponse);
                const availableMarkets = discoveredMarkets.length ? discoveredMarkets : FALLBACK_MARKETS;
                marketsRef.current = availableMarkets;
                setMarkets(availableMarkets);

                const defaultMarket = availableMarkets.find(market => market.value === '1HZ100V') || availableMarkets[0];
                const requestedSelection = marketSelectionRef.current;
                const selectedMarket = requestedSelection === 'ALL'
                    ? null
                    : availableMarkets.find(market => market.value === requestedSelection) || defaultMarket;
                if (requestedSelection !== 'ALL' && selectedMarket && requestedSelection !== selectedMarket.value) {
                    marketSelectionRef.current = selectedMarket.value;
                    setMarketSelection(selectedMarket.value);
                }
                const marketsToScan = requestedSelection === 'ALL'
                    ? availableMarkets.filter(market => market.isOpen !== false)
                    : selectedMarket ? [selectedMarket] : [];
                if (!marketsToScan.length) throw new Error('No open Deriv markets are available for this selection');

                const responses = await Promise.all(marketsToScan.map(async market => {
                    try {
                        const response = await send({ ticks_history: market.value, count: 1000, end: 'latest', style: 'ticks' });
                        if (response?.error) {
                            addLog(`HISTORY SKIP — ${market.label}: ${response.error.message || 'request rejected'}`);
                            return { market, response: null };
                        }
                        return { market, response };
                    } catch (error: any) {
                        addLog(`HISTORY SKIP — ${market.label}: ${error?.message || 'request failed'}`);
                        return { market, response: null };
                    }
                }));
                if (!activeRef.current) return;
                responses.forEach(({ market, response }) => {
                    const prices = (response?.history?.prices || [])
                        .map(Number)
                        .filter(Number.isFinite);
                    rawHistoryByMarketRef.current[market.value] = prices;
                    const initialPip = market.pipSize ?? 2;
                    marketPipRefs.current[market.value] = initialPip;
                    if (prices.length) {
                        marketPointsRef.current[market.value] = prices.map((quote, index) => ({
                            quote,
                            digit: getDigit(quote, initialPip),
                            epoch: index,
                        })).slice(-1000);
                    }
                });
                const initialSymbol = requestedSelection === 'ALL'
                    ? (marketsToScan.find(market => market.value === '1HZ100V') || marketsToScan[0]).value
                    : (selectedMarket || marketsToScan[0]).value;
                const initialPoints = marketPointsRef.current[initialSymbol] || [];
                activeSymbolRef.current = initialSymbol;
                setSymbol(initialSymbol);
                setPoints(initialPoints);
                setPipSize(marketPipRefs.current[initialSymbol] || 2);
                setCurrentDigit(initialPoints[initialPoints.length - 1]?.digit ?? null);
                setCurrentPrice(initialPoints.length
                    ? initialPoints[initialPoints.length - 1].quote.toFixed(marketPipRefs.current[initialSymbol] || 2)
                    : '');
                if (initialPoints.length) {
                    const initialCandidate = { ...analyze(initialPoints), symbol: initialSymbol };
                    marketCandidatesRef.current[initialSymbol] = initialCandidate;
                    setCandidate(initialCandidate);
                }
                setStatus(requestedSelection === 'ALL'
                    ? `Baselines ready — scanning ${marketsToScan.length} open markets`
                    : `Baseline ready — scanning ${selectedMarket?.label || marketsToScan[0].label}`);

                marketsToScan.forEach(market => {
                    const unsubscribe = subscribeTicks(market.value, point => {
                        if (!activeRef.current) return;
                        const marketSymbol = market.value;
                        const authoritativePip = Number(point.pip_size);
                        if (Number.isFinite(authoritativePip) && authoritativePip >= 0) {
                            marketPipRefs.current[marketSymbol] = authoritativePip;
                            const rawHistory = rawHistoryByMarketRef.current[marketSymbol];
                            if (rawHistory?.length) {
                                marketPointsRef.current[marketSymbol] = rawHistory.map((quote, index) => ({
                                    quote,
                                    digit: getDigit(quote, authoritativePip),
                                    epoch: index,
                                })).slice(-1000);
                                rawHistoryByMarketRef.current[marketSymbol] = [];
                            }
                        }
                        const pip = marketPipRefs.current[marketSymbol] ?? 2;
                        processPoint(marketSymbol, {
                            ...point,
                            digit: getDigit(point.quote, pip),
                        });
                    });
                    unsubscribers.push(unsubscribe);
                });
            } catch (error) {
                if (activeRef.current) {
                    setStatus(error?.message || 'Unable to load market data');
                    addLog(`DATA ERROR — ${error?.message || 'market baseline request failed'}`);
                }
            }
        };
        start();
        return () => {
            activeRef.current = false;
            mountedRef.current = false;
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    }, [addLog, analyze, connected, processPoint, send, subscribeTicks, marketSelection]);

    useEffect(() => {
        runningRef.current = run;
        if (run) {
            if (!authorized) setStatus('Login required before real execution');
            else setStatus(candidate && candidate.score >= minScore ? 'Scanning and validating' : 'Scanning for a qualified setup');
            addLog(authorized ? 'RUN ON — virtual validation gate enabled' : 'RUN requested — waiting for account authorization');
        } else {
            setStatus('SCAN ONLY — no contracts will be executed');
            addLog('RUN OFF — analysis continues without execution');
        }
    }, [addLog, authorized, candidate, minScore, run]);

    const distribution = useMemo(() => percentagesFor(points, 1000), [points]);
    const shortDistribution = useMemo(() => percentagesFor(points, 100), [points]);
    const recentDigits = useMemo(() => points.slice(-30), [points]);
    const oddPressure = shortDistribution.filter((_, index) => index % 2 !== 0).reduce((a, b) => a + b, 0);
    const evenPressure = 100 - oddPressure;
    const activeDuration = autoDuration
        ? Math.max(1, Math.min(5, candidate?.score >= 90 ? 1 : candidate?.score >= 82 ? 2 : candidate?.score >= 74 ? 3 : 4))
        : duration;
    const selectedAutoStrategy = candidate?.strategy || 'AUTO';
    const selectedAutoBarrier = candidate?.barrier;

    const resetEngine = () => {
        lossStreakRef.current = 0;
        setLossStreak(0);
        recoveryBaselineRef.current = null;
        recoveryDeficitRef.current = 0;
        setRecoveryDeficit(0);
        recoveryStakeRef.current = stakeRef.current;
        completedRunsRef.current = 0;
        setCompletedRuns(0);
        autoRotationIndexRef.current = 0;
        recentResultsRef.current = [];
        pnlRef.current = 0;
        setPnl(0);
        setWins(0);
        setLosses(0);
        setTrades([]);
        validationRef.current = { key: '', wins: 0, attempt: 0, readyEpoch: 0 };
        setValidation({ wins: 0, attempt: 0, state: 'IDLE' });
        addLog('RISK STATE RESET — baseline retained');
    };

    const applyBestMartingale = () => {
        const currentBalance = balanceRef.current;
        const base = stakeRef.current;
        // Smaller accounts get a gentler multiplier. This is a starting
        // recommendation only; the hard balance/reserve cap remains active.
        const recommended = !currentBalance || currentBalance < base * 20
            ? 1.25
            : currentBalance < base * 50 ? 1.35 : 1.45;
        setBestMartingale(recommended);
        recoveryStakeRef.current = base;
        addLog(`BEST MARTINGALE — ${recommended.toFixed(2)}x selected; recovery will reduce after wins`);
    };

    const startBot = () => {
        sessionStartBalanceRef.current = balanceRef.current;
        completedRunsRef.current = 0;
        setCompletedRuns(0);
        recoveryStakeRef.current = stakeRef.current;
        autoRotationIndexRef.current = 0;
        setRun(true);
        setStatus(authorized ? 'Scanning and validating' : 'Login required before real execution');
        addLog(authorized ? 'START BOT — virtual validation gate enabled' : 'START BOT — scanner active, execution waiting for authorization');
    };

    const pauseBot = () => {
        setRun(false);
        setStatus('PAUSED — open contracts remain active; no new entries will be sent');
        addLog('PAUSE BOT — scanning paused without resetting risk state');
    };

    const stopBot = () => {
        setRun(false);
        validationRef.current = { key: '', wins: 0, attempt: 0, readyEpoch: 0 };
        setValidation({ wins: 0, attempt: 0, state: 'IDLE' });
        setStatus('STOPPED — press Start Bot to begin a fresh validation gate');
        addLog('STOP BOT — validation gate cleared');
    };

    const closeAllContracts = async () => {
        if (!authorized) {
            setStatus('Login required before closing contracts');
            addLog('CLOSE ALL — rejected because no account is authorized');
            return;
        }
        try {
            const response = await send({ portfolio: 1 });
            if (response?.error) throw new Error(response.error.message || 'Portfolio request failed');
            const contracts = Array.isArray(response?.portfolio?.contracts) ? response.portfolio.contracts : [];
            const sellable = contracts.filter((contract: any) =>
                contract?.contract_id != null &&
                !contract?.is_sold &&
                (contract?.is_valid_to_sell === 1 || contract?.is_valid_to_sell === true)
            );
            if (!sellable.length) {
                setStatus('CLOSE ALL — no sellable open contracts found');
                addLog('CLOSE ALL — portfolio is clear');
                return;
            }
            const results = await Promise.allSettled(sellable.map((contract: any) =>
                send({ sell: Number(contract.contract_id), price: 0 })
            ));
            const closed = results.filter(result => result.status === 'fulfilled' && !(result.value as any)?.error).length;
            const failed = results.length - closed;
            setStatus(failed ? `CLOSE ALL — ${closed} closed, ${failed} failed` : `CLOSE ALL — ${closed} contract${closed === 1 ? '' : 's'} closed`);
            addLog(failed ? `CLOSE ALL — ${closed} closed, ${failed} sell requests failed` : `CLOSE ALL — ${closed} sell request${closed === 1 ? '' : 's'} completed`);
        } catch (error: any) {
            setStatus(`CLOSE ALL — ${error?.message || 'request failed'}`);
            addLog(`CLOSE ALL ERROR — ${error?.message || 'portfolio request failed'}`);
        }
    };

    return (
        <div className='auto-digits'>
            <header className='auto-digits__topbar'>
                <div>
                    <div className='auto-digits__eyebrow'>AUTONOMOUS MARKET INTELLIGENCE</div>
                    <h1>Auto-Digits <span>Engine</span></h1>
                    <p>Multi-window distribution, pattern validation, and controlled execution.</p>
                </div>
                <div className='auto-digits__top-actions'>
                    <span className={`ad-status-dot ${connected ? 'is-live' : ''}`}>{connected ? 'CONNECTED' : 'OFFLINE'}</span>
                    <span className={`ad-status-dot ${authorized ? 'is-authorized' : ''}`}>{authorized ? 'ACCOUNT READY' : 'ANALYSIS ONLY'}</span>
                    <button className={`ad-run-toggle ${run ? 'is-on' : ''}`} onClick={run ? pauseBot : startBot}>
                        <span className='ad-toggle-dot' /> {run ? 'RUNNING' : 'RUN ENGINE'}
                    </button>
                </div>
            </header>

            <div className='auto-digits__layout'>
                <aside className='auto-digits__sidebar'>
                    <section className='ad-panel ad-account'>
                        <div className='ad-panel__label'>ACCOUNT OVERVIEW</div>
                        <div className='ad-balance'>{balance == null ? '—' : `${fromUsd(balance).toFixed(2)} ${displayCur}`}</div>
                        <div className='ad-stat-grid'>
                            <div><span>Profit / Loss</span><strong className={pnl >= 0 ? 'positive' : 'negative'}>{pnl >= 0 ? '+' : ''}{fromUsd(pnl).toFixed(2)}</strong></div>
                            <div><span>Win Rate</span><strong>{wins + losses ? `${Math.round((wins / (wins + losses)) * 100)}%` : '—'}</strong></div>
                            <div><span>Wins</span><strong className='positive'>{wins}</strong></div>
                            <div><span>Losses</span><strong className='negative'>{losses}</strong></div>
                        </div>
                    </section>

                    <section className='ad-panel ad-recovery'>
                        <div className='ad-panel__label'>LOSS RECOVERY ENGINE</div>
                        <div className='ad-recovery__line'><span>Current loss streak</span><strong>{lossStreak}</strong></div>
                        <div className='ad-recovery__line'><span>Recovery deficit</span><strong>{fromUsd(recoveryDeficit).toFixed(2)} {displayCur}</strong></div>
                        <div className='ad-recovery__line'><span>Next stake</span><strong>{fromUsd(Math.max(0.35, autoStakeEnabled && completedRuns >= 5 ? recoveryStakeRef.current : stakeRef.current)).toFixed(2)} {displayCur}</strong></div>
                        <div className='ad-recovery__line'><span>Auto-stake</span><b>{autoStakeEnabled ? `${Math.max(0, 5 - completedRuns)} runs to warm-up` : 'OFF · manual only'}</b></div>
                        <div className='ad-recovery__line'><span>Martingale</span><b>{bestMartingale.toFixed(2)}x</b></div>
                        <div className='ad-recovery__line'><span>Mode</span><b>{lossStreak >= 3 ? 'RE-SCAN' : recoveryDeficit ? 'CONTROLLED' : 'NORMAL'}</b></div>
                        <button className='ad-outline-btn' onClick={resetEngine}>RESET RISK STATE</button>
                    </section>

                    <section className='ad-panel ad-controls'>
                        <div className='ad-panel__label'>BOT CONFIGURATION</div>
                        <label>MARKET
                            <select value={marketSelection} onChange={event => setMarketSelection(event.target.value)}>
                                <option value='ALL'>Scan all available markets</option>
                                {markets.map(market => (
                                    <option key={market.value} value={market.value}>
                                        {market.label}{market.isOpen === false ? ' (Closed)' : ''}
                                    </option>
                                ))}
                            </select>
                            <small className='ad-control-hint'>{markets.length} markets from the Deriv active-symbols feed</small>
                        </label>
                        <label>CONTRACT TYPE<select value={strategy} onChange={event => { const value = event.target.value as StrategyValue; setStrategy(value); if (value === 'AUTO') setAutoDuration(true); }}>{['Auto', 'Parity', 'Digits', 'Barrier', 'Direction', 'Range'].map(group => <optgroup key={group} label={group}>{STRATEGIES.filter(item => item.group === group).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup>)}</select></label>
                        <div className='ad-auto-selection'>
                            <span>SAFE CONTRACT ROTATION</span>
                            <strong>{selectedAutoStrategy}{selectedAutoBarrier != null ? ` · BARRIER ${selectedAutoBarrier}` : ''}</strong>
                            <small>AUTO rotates Over 4–8, Under 4–1, Matches/Differs 0–9, Even/Odd, Rise/Fall and tick contracts.</small>
                        </div>
                        <div className='ad-control-row'><label>STAKE<NumberField value={Number(stake) || 0.35} min={0.35} max={1000} onCommit={value => setStake(value.toFixed(2))} /></label><label>MIN SCORE<NumberField value={minScore} min={50} max={95} onCommit={setMinScore} /></label></div>
                        <div className='ad-duration-row'><span>DURATION</span><button className={autoDuration ? 'is-active' : ''} onClick={() => setAutoDuration(true)}>AUTO {activeDuration}T</button>{[1, 2, 3, 4, 5].map(value => <button key={value} className={!autoDuration && duration === value ? 'is-active' : ''} onClick={() => { setAutoDuration(false); setDuration(value); }}>{value}T</button>)}</div>
                        <label>ENTRY LOGIC<select value={logicMode} onChange={event => setLogicMode(event.target.value)}>{LOGIC_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
                        <div className='ad-risk-panel'>
                            <div className='ad-risk-panel__heading'><span>TAKE PROFIT & RISK LIMITS</span><small>Stops new trades before the account floor is crossed.</small></div>
                            <div className='ad-control-row'><label>TAKE PROFIT (USD)<NumberField value={Number(takeProfit) || 0.01} min={0.01} max={100000} onCommit={value => setTakeProfit(value.toFixed(2))} /></label><label>SESSION LOSS (USD)<NumberField value={Number(maxSessionLoss) || 0.35} min={0.35} max={100000} onCommit={value => setMaxSessionLoss(value.toFixed(2))} /></label></div>
                            <div className='ad-control-row'><label>RESERVE %<NumberField value={reservePercent} min={10} max={90} onCommit={setReservePercent} /></label><label>MAX STAKE %<NumberField value={maxStakePercent} min={1} max={25} onCommit={setMaxStakePercent} /></label></div>
                            <div className='ad-risk-actions'>
                                <button className={`ad-risk-toggle ${autoStakeEnabled ? 'is-active' : ''}`} onClick={() => setAutoStakeEnabled(value => !value)}>
                                    {autoStakeEnabled ? 'AUTO STAKE ON' : 'AUTO STAKE OFF'}
                                </button>
                                <button className='ad-risk-toggle' onClick={applyBestMartingale}>SET BEST MARTINGALE</button>
                            </div>
                            <p className='ad-risk-note'>Manual stake remains the base. Auto stake starts after 5 settled runs, reduces after recovery wins, and is capped by balance, reserve, and session-loss limits.</p>
                        </div>
                    </section>
                    <section className='ad-panel ad-quick-actions'>
                        <div className='ad-panel__label'>QUICK ACTIONS</div>
                        <div className='ad-quick-actions__grid'>
                            <button className='ad-action ad-action--start' onClick={startBot} disabled={run}>Start Bot</button>
                            <button className='ad-action ad-action--pause' onClick={pauseBot} disabled={!run}>Pause Bot</button>
                            <button className='ad-action ad-action--stop' onClick={stopBot} disabled={!run && validation.state === 'IDLE'}>Stop Bot</button>
                            <button className='ad-action ad-action--close' onClick={closeAllContracts}>Close All</button>
                        </div>
                    </section>
                </aside>

                <main className='auto-digits__main'>
                    <section className='ad-panel ad-distribution'>
                        <div className='ad-section-heading'><div><div className='ad-panel__label'>DIGIT DISTRIBUTION <span>(1,000 TICKS)</span></div><h2>Market baseline <small>pip size {pipSize}</small></h2></div><div className='ad-live-readout'><span>LIVE DIGIT</span><strong>{currentDigit == null ? '—' : currentDigit}</strong><small>{currentPrice || 'Waiting for tick'}</small></div></div>
                        <div className='ad-digit-grid'>
                            {distribution.map((percentage, digit) => {
                                const isCurrent = currentDigit === digit;
                                const isStrong = percentage >= 10.5;
                                const isWeak = percentage < 9.5;
                                return <div key={digit} className={`ad-digit ${isCurrent ? 'is-current' : ''} ${isStrong ? 'is-strong' : ''} ${isWeak ? 'is-weak' : ''}`}><div className='ad-digit__circle'><span>{digit}</span>{isCurrent && <i />}</div><strong>{percentage.toFixed(1)}%</strong><small>{Math.round((percentage / 100) * Math.max(points.length, 1000))} ticks</small></div>;
                            })}
                        </div>
                        <div className='ad-distribution-footer'><span className='ad-moving-pointer'><i /> moving pointer = current digit</span><span>{points.length.toLocaleString()} / 1,000 ticks loaded</span></div>
                    </section>

                    <div className='ad-two-col'>
                        <section className='ad-panel ad-strategy'>
                            <div className='ad-panel__label'>CURRENT STRATEGY</div>
                            <div className='ad-strategy__headline'><strong>{candidate?.label || `${strategy}${['OVER', 'UNDER'].includes(strategy) ? ` ${candidate?.barrier ?? 3}` : ''}`}</strong><div className='ad-score'><b>{candidate?.score || 0}</b><span>/100</span></div></div>
                            <div className='ad-progress'><i style={{ width: `${candidate?.score || 0}%` }} /></div>
                            <div className='ad-strategy__meta'><span className={`ad-confidence confidence-${(candidate?.confidence || 'wait').toLowerCase().replace(' ', '-')}`}>{candidate?.confidence || 'WAIT'}</span><span>Threshold {minScore}</span></div>
                            <p className='ad-reason'>{candidate?.reason || 'The engine will compare the 20T, 50T, 100T, and 1,000T windows.'}</p>
                            <div className='ad-checks'><span className={points.length >= 1000 ? 'pass' : ''}>Distribution baseline <b>{points.length >= 1000 ? 'READY' : 'BUILDING'}</b></span><span className={candidate?.score >= minScore ? 'pass' : ''}>Entry score <b>{candidate?.score >= minScore ? 'QUALIFIED' : 'WAITING'}</b></span><span className={validation.state === 'PASSED' ? 'pass' : ''}>Virtual gate <b>{validation.state}</b></span></div>
                        </section>
                        <section className='ad-panel ad-pressure'>
                            <div className='ad-panel__label'>WINDOW PRESSURE</div>
                            <div className='ad-pressure__row'><span>1,000 TICKS</span><b>{strategy === 'ODD' || strategy === 'EVEN' ? `${(strategy === 'ODD' ? oddPressure : evenPressure).toFixed(0)}% ${strategy}` : `${distribution.reduce((a, b) => Math.max(a, b), 0).toFixed(1)}% PEAK`}</b><i><em style={{ width: `${strategy === 'ODD' || strategy === 'EVEN' ? (strategy === 'ODD' ? oddPressure : evenPressure) : Math.max(...distribution)}%` }} /></i></div>
                            <div className='ad-pressure__row'><span>100 TICKS</span><b>{strategy === 'ODD' || strategy === 'EVEN' ? `${(strategy === 'ODD' ? oddPressure : evenPressure).toFixed(0)}% ${strategy}` : `${Math.max(...shortDistribution).toFixed(1)}% PEAK`}</b><i><em style={{ width: `${Math.min(100, strategy === 'ODD' || strategy === 'EVEN' ? (strategy === 'ODD' ? oddPressure : evenPressure) : Math.max(...shortDistribution) * 2)}%` }} /></i></div>
                            <div className='ad-pressure__row'><span>50 TICKS</span><b>{candidate?.touches ? `${candidate.touches}/10 TOUCHES` : `${Math.round((candidate?.retention || 0))}% RETAIN`}</b><i><em style={{ width: `${candidate?.touches ? candidate.touches * 10 : candidate?.retention || 0}%` }} /></i></div>
                            <div className='ad-pressure__row'><span>20 TICKS</span><b>{currentDigit == null ? 'WAITING' : `${recentDigits.length} RECENT`}</b><i><em style={{ width: `${Math.min(100, recentDigits.length * 3.3)}%` }} /></i></div>
                        </section>
                    </div>

                    <div className='ad-three-col'>
                        <section className='ad-panel ad-recent'><div className='ad-panel__label'>RECENT TICKS <span>(LAST 30)</span></div><div className='ad-ticks'>{recentDigits.map((point, index) => <span key={`${point.epoch}-${index}`} className={point.digit % 2 === 0 ? 'even' : 'odd'}>{point.digit}</span>)}</div><div className='ad-parity-bar'><i style={{ width: `${oddPressure}%` }} /><span>ODD {oddPressure.toFixed(0)}%</span><b>EVEN {evenPressure.toFixed(0)}%</b></div></section>
                        <section className='ad-panel ad-validation'><div className='ad-panel__label'>VIRTUAL VALIDATION</div><div className='ad-validation__steps'><span className={validation.wins >= 1 ? 'done' : ''}><b>1</b> VIRTUAL {validation.wins >= 1 ? 'WIN' : 'READY'}</span><span className={validation.wins >= 2 ? 'done' : ''}><b>2</b> VIRTUAL {validation.wins >= 2 ? 'WIN' : 'WAITING'}</span><strong className={validation.state === 'PASSED' ? 'passed' : ''}>{validation.state === 'PASSED' ? 'PASSED' : 'GATE ACTIVE'}</strong></div></section>
                        <section className='ad-panel ad-entry'><div className='ad-panel__label'>ENTRY DECISION</div><strong>{status}</strong><p>{strategy === 'AUTO' ? 'Auto mode compares Over, Under, Even, Odd, Matches, Differs, Rise/Fall, and tick contracts before choosing the strongest entry.' : logicMode === 'confluence' ? 'All windows are compared before an entry is accepted.' : LOGIC_MODES.find(mode => mode.value === logicMode)?.note}</p><div className='ad-entry__ticks'><span>Next contract</span><b>{candidate?.contractType || '—'} {candidate?.barrier != null ? `· Barrier ${candidate.barrier}` : ''}</b><small>{activeDuration} ticks {autoDuration ? '· AUTO' : ''}</small></div></section>
                    </div>
                </main>

                <aside className='auto-digits__rightbar'>
                     <section className='ad-panel ad-engine-status'><div className='ad-panel__label'>BOT STATUS</div><div className={`ad-big-status ${run ? 'is-running' : ''}`}>{run ? 'RUNNING' : 'SCANNING'}</div><div className='ad-right-line'><span>Selected market</span><b>{marketSelection === 'ALL' ? `Auto scan · ${marketLabel(symbol)}` : markets.find(market => market.value === marketSelection)?.label || marketLabel(symbol)}</b></div><div className='ad-right-line'><span>Selection</span><b>{strategy === 'AUTO' ? 'All strategies + best score' : 'Condition + barrier'}</b></div><div className='ad-right-line'><span>Speed</span><b>Authenticated tick feed</b></div><div className='ad-right-line'><span>Data quality</span><b className={points.length >= 1000 ? 'positive' : ''}>{points.length >= 1000 ? '1,000T READY' : `${points.length}T`}</b></div><div className='ad-right-line'><span>Authorization</span><b className={authorized ? 'positive' : 'negative'}>{authorized ? 'DEMO / REAL' : 'LOGIN NEEDED'}</b></div></section>
                    <section className='ad-panel ad-log'><div className='ad-panel__label'>ENGINE JOURNAL</div><div className='ad-log__items'>{log.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}</div></section>
                    <section className='ad-panel ad-results'><div className='ad-panel__label'>RECENT RESULTS</div>{trades.length === 0 ? <p className='ad-empty'>No executed contracts yet. Run stays gated behind two virtual wins.</p> : trades.slice(0, 6).map(trade => <div className='ad-result' key={trade.id}><span>{trade.time}</span><b>{trade.strategy}</b><strong className={trade.status === 'WIN' ? 'positive' : trade.status === 'LOSS' ? 'negative' : ''}>{trade.status === 'OPEN' ? 'OPEN' : `${trade.profit >= 0 ? '+' : ''}${fromUsd(trade.profit).toFixed(2)}`}</strong></div>)}</section>
                </aside>
            </div>
        </div>
    );
});

export default AutoDigits;