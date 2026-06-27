// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { DigitStat } from '@/hooks/useDigitStats';
import './ai-assistant.scss';

interface AIScanResult {
  symbol: string;
  recommendation: string;
  confidence: number;
  tradeType: string;
  entry: string;
}

interface AIAssistantProps {
  digits?: DigitStat[];
  lastDigit?: number | null;
  symbol?: string;
  onTrade?: (type: string, barrier?: number) => void;
}

type ScanTradeType = 'over_under' | 'matches_differs' | 'even_odd' | 'rise_fall';

const SYMBOLS = [
  'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
  '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V',
];

const analyzeDigits = (digits: DigitStat[], tradeType: ScanTradeType) => {
  if (!digits || digits.length === 0) return null;
  const sorted = [...digits].sort((a, b) => a.percentage - b.percentage);
  const highest = [...digits].sort((a, b) => b.percentage - a.percentage)[0];
  const lowest = sorted[0];

  if (tradeType === 'over_under') {
    const shield = digits.find(d => d.percentage >= 10.3 && d.digit > lowest.digit);
    return {
      recommendation: lowest.percentage < 9.8 ? `Over ${lowest.digit}` : `Under ${highest.digit}`,
      confidence: Math.min(95, Math.max(55, 100 - lowest.percentage * 5)),
      entry: `Digit ${lowest.digit} (${lowest.percentage}%)`,
    };
  }
  if (tradeType === 'even_odd') {
    const evenPct = digits.filter(d => d.digit % 2 === 0).reduce((s, d) => s + d.percentage, 0);
    return {
      recommendation: evenPct > 50 ? 'Buy Even' : 'Buy Odd',
      confidence: Math.min(90, Math.abs(evenPct - 50) * 4 + 55),
      entry: `Even: ${evenPct.toFixed(1)}% / Odd: ${(100 - evenPct).toFixed(1)}%`,
    };
  }
  if (tradeType === 'rise_fall') {
    return {
      recommendation: highest.percentage > 11 ? 'Buy Rise' : 'Buy Fall',
      confidence: Math.min(85, highest.percentage * 6),
      entry: `Highest: ${highest.digit} (${highest.percentage}%)`,
    };
  }
  return {
    recommendation: `Match ${highest.digit}`,
    confidence: Math.min(80, highest.percentage * 5),
    entry: `Top digit: ${highest.digit}`,
  };
};

const AIAssistant: React.FC<AIAssistantProps> = ({ digits = [], lastDigit, symbol, onTrade }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [tradeType, setTradeType] = useState<ScanTradeType>('over_under');
  const [stake, setStake] = useState(1);
  const [predBeforeLoss, setPredBeforeLoss] = useState(0);
  const [predAfterLoss, setPredAfterLoss] = useState(0);
  const [martingale, setMartingale] = useState(2.2);
  const [multiMarket, setMultiMarket] = useState(true);
  const [scanResults, setScanResults] = useState<AIScanResult[]>([]);
  const [isPulsing, setIsPulsing] = useState(true);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setScanResults([]);

    // Simulate multi-market scan
    await new Promise(r => setTimeout(r, 800));

    const results: AIScanResult[] = (multiMarket ? SYMBOLS : [symbol || 'R_10']).map(sym => {
      const fakeDigits: DigitStat[] = Array.from({ length: 10 }, (_, i) => ({
        digit: i,
        count: Math.floor(Math.random() * 120 + 80),
        percentage: 7 + Math.random() * 6,
      }));
      const analysis = analyzeDigits(digits.length > 0 ? digits : fakeDigits, tradeType);
      return {
        symbol: sym,
        tradeType: tradeType.replace('_', '/'),
        recommendation: analysis?.recommendation || 'Hold',
        confidence: analysis?.confidence || 60,
        entry: analysis?.entry || '-',
      };
    });

    results.sort((a, b) => b.confidence - a.confidence);
    setScanResults(results);
    setIsScanning(false);
  }, [digits, tradeType, multiMarket, symbol]);

  const currentAnalysis = digits.length > 0 ? analyzeDigits(digits, tradeType) : null;

  return (
    <>
      {/* Floating AI Sphere Button */}
      <button
        className={`ai-assistant__trigger ${isPulsing ? 'ai-assistant__trigger--pulse' : ''}`}
        onClick={() => { setIsOpen(true); setIsPulsing(false); }}
        title='AI Market Scanner'
      >
        <div className='ai-assistant__sphere'>
          <span>AI</span>
        </div>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className='ai-assistant__overlay' onClick={() => setIsOpen(false)}>
          <div className='ai-assistant__modal' onClick={e => e.stopPropagation()}>
            <div className='ai-assistant__modal-header'>
              <div className='ai-assistant__status-dot' />
              <h3>AI Market Scanner</h3>
              <button className='ai-assistant__close' onClick={() => setIsOpen(false)}>✕</button>
            </div>

            <div className='ai-assistant__body'>
              <div className='ai-assistant__field'>
                <label>TRADE TYPE</label>
                <div className='ai-assistant__trade-types'>
                  {(['matches_differs', 'even_odd', 'over_under', 'rise_fall'] as ScanTradeType[]).map(t => (
                    <button
                      key={t}
                      className={`ai-assistant__type-btn ${tradeType === t ? 'active' : ''}`}
                      onClick={() => setTradeType(t)}
                    >
                      {t.replace(/_/g, '/').replace(/\b\w/g, c => c.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>

              <div className='ai-assistant__field'>
                <label>STAKE AMOUNT</label>
                <input type='number' value={stake} onChange={e => setStake(Number(e.target.value))} min={0.35} step={0.1} />
              </div>

              <div className='ai-assistant__field'>
                <label>PREDICTION BEFORE LOSS</label>
                <input type='number' value={predBeforeLoss} onChange={e => setPredBeforeLoss(Number(e.target.value))} min={0} />
              </div>

              <div className='ai-assistant__field'>
                <label>PREDICTION AFTER LOSS</label>
                <input type='number' value={predAfterLoss} onChange={e => setPredAfterLoss(Number(e.target.value))} min={0} />
              </div>

              <div className='ai-assistant__field'>
                <label>MARTINGALE MULTIPLIER</label>
                <input type='number' value={martingale} onChange={e => setMartingale(Number(e.target.value))} min={1} step={0.1} />
              </div>

              <div className='ai-assistant__field ai-assistant__field--toggle'>
                <div>
                  <strong style={{ color: '#42B883' }}>Multi-Market Scan</strong>
                  <p>Scanning all {SYMBOLS.length} markets</p>
                </div>
                <label className='ai-assistant__toggle'>
                  <input type='checkbox' checked={multiMarket} onChange={e => setMultiMarket(e.target.checked)} />
                  <span className='ai-assistant__toggle-slider' />
                </label>
              </div>

              {currentAnalysis && (
                <div className='ai-assistant__live-analysis'>
                  <p>📊 Live: <strong>{currentAnalysis.recommendation}</strong> — {currentAnalysis.confidence.toFixed(0)}% confidence</p>
                  <p>Entry: {currentAnalysis.entry}</p>
                </div>
              )}

              {scanResults.length > 0 && (
                <div className='ai-assistant__results'>
                  {scanResults.slice(0, 5).map(r => (
                    <div key={r.symbol} className={`ai-assistant__result ${r.confidence >= 75 ? 'ai-assistant__result--hot' : ''}`}>
                      <span className='ai-assistant__result-sym'>{r.symbol}</span>
                      <span className='ai-assistant__result-rec'>{r.recommendation}</span>
                      <span className='ai-assistant__result-conf'>{r.confidence.toFixed(0)}%</span>
                      {onTrade && (
                        <button className='ai-assistant__result-trade' onClick={() => onTrade(r.recommendation, undefined)}>
                          Trade
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className='ai-assistant__footer'>
              <button className='ai-assistant__btn ai-assistant__btn--cancel' onClick={() => setIsOpen(false)}>
                Cancel
              </button>
              <button className='ai-assistant__btn ai-assistant__btn--scan' onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scanning...' : 'Scan Markets'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
