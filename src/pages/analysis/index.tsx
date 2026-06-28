// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useDigitStats } from '@/hooks/useDigitStats';
import DigitCircles from '@/components/digit-circles';
import './analysis.scss';

const MARKETS = [
  { group: 'Volatility', items: [
    { label: 'V10', value: 'R_10' }, { label: 'V25', value: 'R_25' },
    { label: 'V50', value: 'R_50' }, { label: 'V75', value: 'R_75' },
    { label: 'V100', value: 'R_100' },
  ]},
  { group: 'Volatility 1s', items: [
    { label: 'V10 1s', value: '1HZ10V' }, { label: 'V25 1s', value: '1HZ25V' },
    { label: 'V50 1s', value: '1HZ50V' }, { label: 'V75 1s', value: '1HZ75V' },
    { label: 'V100 1s', value: '1HZ100V' },
  ]},
  { group: 'Jump', items: [
    { label: 'Jump 10', value: 'JD10' }, { label: 'Jump 25', value: 'JD25' },
    { label: 'Jump 50', value: 'JD50' }, { label: 'Jump 75', value: 'JD75' },
    { label: 'Jump 100', value: 'JD100' },
  ]},
];

type AnalysisResult = {
  type: string;
  signal: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
  confidence: number;
  reason: string;
  prediction?: number | string;
};

function analyseDigits(digits: any[]): AnalysisResult[] {
  if (!digits || digits.length < 10) return [];

  const sorted = [...digits].sort((a, b) => b.percentage - a.percentage);
  const highest = sorted[0];
  const secondHigh = sorted[1];
  const sortedAsc = [...digits].sort((a, b) => a.percentage - b.percentage);
  const lowest = sortedAsc[0];
  const secondLow = sortedAsc[1];

  const evenTotal = digits.filter(d => d.digit % 2 === 0).reduce((s, d) => s + d.percentage, 0);
  const oddTotal = 100 - evenTotal;
  const overTotal = (digit: number) => digits.filter(d => d.digit > digit).reduce((s, d) => s + d.percentage, 0);
  const underTotal = (digit: number) => digits.filter(d => d.digit < digit).reduce((s, d) => s + d.percentage, 0);

  const results: AnalysisResult[] = [];

  // ─── Over/Under Analysis ───────────────────────────────
  // OVER: if highest digit > 5 and its % dominates
  const over5 = overTotal(5);
  const under5 = underTotal(6);
  if (highest.digit >= 6 && highest.percentage > 14) {
    results.push({
      type: 'Over/Under', signal: 'STRONG BUY',
      confidence: Math.min(97, 60 + (highest.percentage - 10) * 2.5),
      reason: `Digit ${highest.digit} dominates at ${highest.percentage.toFixed(1)}% — OVER ${highest.digit - 1} is favored`,
      prediction: `OVER ${highest.digit - 1}`,
    });
  } else if (lowest.digit <= 4 && lowest.percentage < 6) {
    results.push({
      type: 'Over/Under', signal: 'BUY',
      confidence: Math.min(90, 55 + (10 - lowest.percentage) * 2),
      reason: `Digit ${lowest.digit} is suppressed at ${lowest.percentage.toFixed(1)}% — OVER ${lowest.digit} is favored`,
      prediction: `OVER ${lowest.digit}`,
    });
  } else if (lowest.digit >= 7) {
    results.push({
      type: 'Over/Under', signal: 'BUY',
      confidence: Math.min(88, 58 + (lowest.percentage - 10) * 1.5),
      reason: `Low digit ${lowest.digit} at ${lowest.percentage.toFixed(1)}% — UNDER ${lowest.digit + 1} favored`,
      prediction: `UNDER ${lowest.digit + 1}`,
    });
  } else {
    results.push({
      type: 'Over/Under', signal: 'NEUTRAL',
      confidence: 50,
      reason: 'No strong Over/Under signal — digit distribution balanced',
      prediction: '—',
    });
  }

  // ─── Even/Odd Analysis ─────────────────────────────────
  const evenOddBias = Math.abs(evenTotal - 50);
  if (evenTotal > 55) {
    results.push({
      type: 'Even/Odd', signal: evenTotal > 60 ? 'STRONG BUY' : 'BUY',
      confidence: Math.min(95, 50 + evenOddBias * 1.8),
      reason: `Even digits collectively ${evenTotal.toFixed(1)}% — EVEN bias detected`,
      prediction: 'EVEN',
    });
  } else if (oddTotal > 55) {
    results.push({
      type: 'Even/Odd', signal: oddTotal > 60 ? 'STRONG BUY' : 'BUY',
      confidence: Math.min(95, 50 + evenOddBias * 1.8),
      reason: `Odd digits collectively ${oddTotal.toFixed(1)}% — ODD bias detected`,
      prediction: 'ODD',
    });
  } else {
    results.push({
      type: 'Even/Odd', signal: 'NEUTRAL',
      confidence: 50 + evenOddBias,
      reason: `Even: ${evenTotal.toFixed(1)}% / Odd: ${oddTotal.toFixed(1)}% — near balance`,
      prediction: evenTotal > 50 ? 'Slight EVEN' : 'Slight ODD',
    });
  }

  // ─── Rise/Fall Analysis ────────────────────────────────
  // Based on digit trend (high digits = likely rise on next tick conceptually)
  const highDigitWeight = digits.filter(d => d.digit >= 5).reduce((s, d) => s + d.percentage, 0);
  const lowDigitWeight = 100 - highDigitWeight;
  if (highDigitWeight > 55) {
    results.push({
      type: 'Rise/Fall', signal: highDigitWeight > 62 ? 'STRONG BUY' : 'BUY',
      confidence: Math.min(90, 45 + (highDigitWeight - 50) * 1.2),
      reason: `High-digit dominance ${highDigitWeight.toFixed(1)}% — RISE signal`,
      prediction: 'RISE',
    });
  } else if (lowDigitWeight > 55) {
    results.push({
      type: 'Rise/Fall', signal: lowDigitWeight > 62 ? 'STRONG BUY' : 'BUY',
      confidence: Math.min(90, 45 + (lowDigitWeight - 50) * 1.2),
      reason: `Low-digit dominance ${lowDigitWeight.toFixed(1)}% — FALL signal`,
      prediction: 'FALL',
    });
  } else {
    results.push({
      type: 'Rise/Fall', signal: 'NEUTRAL',
      confidence: 50,
      reason: 'Digit distribution balanced — no clear Rise/Fall signal',
      prediction: '—',
    });
  }

  // ─── Matches/Differs ───────────────────────────────────
  // Best MATCH = highest digit; best DIFFER = lowest digit
  results.push({
    type: 'Matches/Differs',
    signal: highest.percentage > 14 ? 'STRONG BUY' : 'BUY',
    confidence: Math.min(94, 50 + (highest.percentage - 10) * 3),
    reason: `Digit ${highest.digit} at ${highest.percentage.toFixed(1)}% — best MATCH candidate; avoid MATCH ${lowest.digit}`,
    prediction: `MATCH ${highest.digit}`,
  });

  return results;
}

const SIGNAL_COLORS: Record<string, string> = {
  'STRONG BUY': '#00e676',
  'BUY': '#42B883',
  'NEUTRAL': '#aaa',
  'SELL': '#ff7043',
  'STRONG SELL': '#f44336',
};

const Analysis = observer(() => {
  const [market, setMarket] = useState('1HZ100V');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [disclaimer, setDisclaimer] = useState(true);
  const [scanCount, setScanCount] = useState(0);
  const [lastScan, setLastScan] = useState<string>('');
  const [autoScan, setAutoScan] = useState(false);
  const autoRef = useRef<any>(null);

  const { digits, lastDigit, currentPrice, isConnected } = useDigitStats(market);

  const runScan = useCallback(() => {
    setScanning(true);
    setTimeout(() => {
      const r = analyseDigits(digits);
      setResults(r);
      setScanCount(n => n + 1);
      setLastScan(new Date().toLocaleTimeString());
      setScanning(false);
    }, 600);
  }, [digits]);

  useEffect(() => {
    if (autoScan) {
      autoRef.current = setInterval(runScan, 5000);
    } else {
      if (autoRef.current) clearInterval(autoRef.current);
    }
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoScan, runScan]);

  // Auto-run once we have data
  useEffect(() => {
    if (digits.length === 10 && results.length === 0) {
      runScan();
    }
  }, [digits, results.length, runScan]);

  const avgConfidence = results.length
    ? (results.reduce((s, r) => s + r.confidence, 0) / results.length).toFixed(1)
    : '—';

  const topSignal = results.length
    ? results.reduce((best, r) => r.confidence > best.confidence ? r : best, results[0])
    : null;

  return (
    <div className='analysis'>
      {/* Risk Disclaimer */}
      {disclaimer && (
        <div className='analysis__disclaimer'>
          <span className='analysis__disclaimer-icon'>⚠</span>
          <div>
            <strong>RISK DISCLAIMER</strong> — This AI analysis is for educational purposes only and does not constitute financial advice. Trading binary options involves significant risk. Past performance does not guarantee future results. Trade responsibly. AHMED SYN TRADER assumes no liability for trading losses.
          </div>
          <button onClick={() => setDisclaimer(false)}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className='analysis__header'>
        <div>
          <h1>🔍 Analysis Tool</h1>
          <p>AHMED SYN TRADER — AI-powered market signal scanner</p>
        </div>
        <div className='analysis__header-stats'>
          <div className='analysis__stat-box'>
            <span>Scans Run</span><strong>{scanCount}</strong>
          </div>
          <div className='analysis__stat-box'>
            <span>Avg Confidence</span><strong>{avgConfidence}%</strong>
          </div>
          <div className='analysis__stat-box'>
            <span>Last Scan</span><strong>{lastScan || '—'}</strong>
          </div>
          <div className={`analysis__conn ${isConnected ? 'analysis__conn--on' : 'analysis__conn--off'}`}>
            {isConnected ? '● Live' : '○ Offline'}
          </div>
        </div>
      </div>

      {/* Market selector */}
      <div className='analysis__market-row'>
        {MARKETS.map(group => (
          <div key={group.group} className='analysis__market-group'>
            <span className='analysis__market-group-label'>{group.group}</span>
            <div className='analysis__market-pills'>
              {group.items.map(m => (
                <button
                  key={m.value}
                  className={`analysis__market-pill ${market === m.value ? 'active' : ''}`}
                  onClick={() => setMarket(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Digit circles + price */}
      <div className='analysis__circles-wrap'>
        <DigitCircles digits={digits} lastDigit={lastDigit} />
        <div className='analysis__price-info'>
          <div className='analysis__price-box'>
            <span>Live Price</span>
            <strong>{currentPrice ?? '—'}</strong>
          </div>
          <div className='analysis__price-box'>
            <span>Last Digit</span>
            <strong className='analysis__last-digit'>{lastDigit ?? '—'}</strong>
          </div>
        </div>
      </div>

      {/* Top AI signal card */}
      {topSignal && (
        <div className='analysis__top-signal' style={{ borderColor: SIGNAL_COLORS[topSignal.signal] }}>
          <div className='analysis__top-signal-label'>🤖 TOP AI SIGNAL</div>
          <div className='analysis__top-signal-type'>{topSignal.type}</div>
          <div className='analysis__top-signal-signal' style={{ color: SIGNAL_COLORS[topSignal.signal] }}>
            {topSignal.signal}
          </div>
          <div className='analysis__top-signal-pred'>{topSignal.prediction}</div>
          <div className='analysis__top-signal-conf'>
            <div className='analysis__conf-bar'>
              <div className='analysis__conf-fill' style={{ width: `${topSignal.confidence}%`, background: SIGNAL_COLORS[topSignal.signal] }} />
            </div>
            <span>{topSignal.confidence.toFixed(1)}% confidence</span>
          </div>
          <div className='analysis__top-signal-reason'>{topSignal.reason}</div>
        </div>
      )}

      {/* Scan controls */}
      <div className='analysis__controls'>
        <button
          className={`analysis__scan-btn ${scanning ? 'scanning' : ''}`}
          onClick={runScan}
          disabled={scanning || !isConnected || digits.length < 10}
        >
          {scanning ? '⏳ Scanning...' : '🔍 Run AI Scan'}
        </button>
        <button
          className={`analysis__auto-btn ${autoScan ? 'active' : ''}`}
          onClick={() => setAutoScan(p => !p)}
        >
          {autoScan ? '⏹ Stop Auto-Scan' : '▶ Auto Scan (5s)'}
        </button>
        {results.length > 0 && (
          <button className='analysis__clear-btn' onClick={() => setResults([])}>
            Clear Results
          </button>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className='analysis__results'>
          <h2>Analysis Results — {new Date().toLocaleTimeString()}</h2>
          <div className='analysis__results-grid'>
            {results.map((r, i) => (
              <div key={i} className='analysis__result-card' style={{ borderColor: SIGNAL_COLORS[r.signal] + '60' }}>
                <div className='analysis__result-header'>
                  <span className='analysis__result-type'>{r.type}</span>
                  <span className='analysis__result-signal' style={{ color: SIGNAL_COLORS[r.signal] }}>
                    {r.signal}
                  </span>
                </div>
                <div className='analysis__result-prediction'>{r.prediction}</div>
                <div className='analysis__result-conf-row'>
                  <div className='analysis__conf-bar'>
                    <div
                      className='analysis__conf-fill'
                      style={{ width: `${r.confidence}%`, background: SIGNAL_COLORS[r.signal] }}
                    />
                  </div>
                  <span className='analysis__result-pct'>{r.confidence.toFixed(1)}%</span>
                </div>
                <p className='analysis__result-reason'>{r.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isConnected && (
        <div className='analysis__offline'>
          <span>⚠ Not connected to market. Please wait...</span>
        </div>
      )}
    </div>
  );
});

export default Analysis;
