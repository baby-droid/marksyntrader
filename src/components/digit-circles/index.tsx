// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { DigitStat } from '@/hooks/useDigitStats';
import './digit-circles.scss';

interface DigitCirclesProps {
  digits: DigitStat[];
  lastDigit: number | null;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  nowrap?: boolean;
}

/**
 * Color scheme:
 *  - GREEN  (#42B883) → ALL digits with the highest % (ties get same color)
 *  - BLUE   (#4E7CF5) → ALL digits with the 2nd highest %
 *  - RED    (#E24A43) → ALL digits with the lowest %
 *  - YELLOW (#F5C842) → ALL digits with the 2nd lowest %
 *  - WHITE  (#FFFFFF) → all others
 *
 *  Priority order: green > red > blue > yellow > white
 *  (so if only 2 unique %s exist: top gets green, bottom gets red)
 */
function computeColors(digits: DigitStat[]): Map<number, string> {
  if (!digits.length) return new Map();

  // Unique percentages sorted descending
  const uniquePcts = [...new Set(digits.map(d => d.percentage))].sort((a, b) => b - a);
  const n = uniquePcts.length;

  const getPctColor = (pct: number): string => {
    const rankHigh = uniquePcts.indexOf(pct);   // 0 = highest tier
    const rankLow  = n - 1 - rankHigh;          // 0 = lowest tier

    if (rankHigh === 0) return '#42B883';        // green  — highest
    if (rankLow  === 0) return '#E24A43';        // red    — lowest
    if (rankHigh === 1) return '#4E7CF5';        // blue   — 2nd highest
    if (rankLow  === 1) return '#F5C842';        // yellow — 2nd lowest
    return '#FFFFFF';
  };

  const map = new Map<number, string>();
  digits.forEach(d => map.set(d.digit, getPctColor(d.percentage)));
  return map;
}

function textColor(bg: string): string {
  if (bg === '#FFFFFF' || bg === '#F5C842') return '#1a1a2e';
  return '#FFFFFF';
}

const DigitCircles: React.FC<DigitCirclesProps> = ({
  digits,
  lastDigit,
  showPercentage = true,
  size = 'md',
  nowrap = false,
}) => {
  const colorMap = computeColors(digits);

  // For legend/stats — use percentage-group approach (all digits sharing the max %)
  const uniquePcts = [...new Set(digits.map(d => d.percentage))].sort((a, b) => b - a);
  const highestPct   = uniquePcts[0];
  const secondHighPct = uniquePcts[1];
  const lowestPct    = uniquePcts[uniquePcts.length - 1];
  const secondLowPct  = uniquePcts[uniquePcts.length - 2];

  const highDigits  = digits.filter(d => d.percentage === highestPct);
  const high2Digits = digits.filter(d => d.percentage === secondHighPct && secondHighPct !== highestPct);
  const lowDigits   = digits.filter(d => d.percentage === lowestPct);
  const low2Digits  = digits.filter(d => d.percentage === secondLowPct && secondLowPct !== lowestPct);

  // cursor animation — smoothly moves indicator to active digit
  const cursorRef = useRef<HTMLDivElement>(null);
  const rowRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lastDigit === null || lastDigit === undefined) return;
    if (!cursorRef.current || !rowRef.current) return;
    const activeEl = rowRef.current.querySelector(`[data-digit="${lastDigit}"]`) as HTMLElement | null;
    if (!activeEl) return;
    const rowRect  = rowRef.current.getBoundingClientRect();
    const circleEl = activeEl.querySelector('.digit-circles__circle') as HTMLElement | null;
    if (!circleEl) return;
    const circRect = circleEl.getBoundingClientRect();
    const cx = circRect.left - rowRect.left + circRect.width / 2;
    const cy = circRect.top  - rowRect.top  + circRect.height / 2;
    const r  = circRect.width / 2 + 6;
    cursorRef.current.style.transform = `translate(${cx}px, ${cy}px)`;
    cursorRef.current.style.width  = `${r * 2}px`;
    cursorRef.current.style.height = `${r * 2}px`;
    cursorRef.current.style.marginLeft = `${-r}px`;
    cursorRef.current.style.marginTop  = `${-r}px`;
    cursorRef.current.style.opacity = '1';
  }, [lastDigit, digits, size]);

  return (
    <div className={`digit-circles digit-circles--${size}${nowrap ? ' digit-circles--nowrap' : ''}`}>
      {/* Row with positioned cursor */}
      <div className='digit-circles__row-wrap'>
        <div className='digit-circles__row' ref={rowRef}>
          {/* Animated cursor ring */}
          <div
            ref={cursorRef}
            className='digit-circles__cursor'
            style={{ opacity: lastDigit === null ? 0 : 1 }}
          />

          {digits.map(({ digit, percentage }) => {
            const bg      = colorMap.get(digit) ?? '#FFFFFF';
            const fg      = textColor(bg);
            const isLast  = digit === lastDigit;
            const isHigh  = percentage === highestPct;
            const isHigh2 = percentage === secondHighPct && secondHighPct !== highestPct;
            const isLow   = percentage === lowestPct;
            const isLow2  = percentage === secondLowPct && secondLowPct !== lowestPct;

            return (
              <div
                key={digit}
                data-digit={digit}
                className={`digit-circles__wrapper${isLast ? ' digit-circles__wrapper--current' : ''}`}
              >
                <div
                  className='digit-circles__circle'
                  style={{
                    background: bg,
                    color: fg,
                    border: isLast
                      ? `3px solid ${bg === '#FFFFFF' || bg === '#F5C842' ? '#1a1a2e' : '#fff'}`
                      : `2px solid ${bg === '#FFFFFF' ? '#D9D9D9' : bg}`,
                    boxShadow: isLast
                      ? `0 0 14px ${bg}aa, 0 0 4px ${bg}`
                      : `0 2px 6px rgba(0,0,0,0.12)`,
                  }}
                >
                  <span className='digit-circles__number'>{digit}</span>
                  {showPercentage && (
                    <span className='digit-circles__percent'>{percentage.toFixed(1)}%</span>
                  )}
                </div>

                {/* rank badges */}
                {isLast  && <span className='digit-circles__rank digit-circles__rank--current'>▼</span>}
                {isHigh  && !isLast && <span className='digit-circles__rank digit-circles__rank--1st'>▲</span>}
                {isHigh2 && <span className='digit-circles__rank digit-circles__rank--2nd'>2nd</span>}
                {isLow   && !isLast && <span className='digit-circles__rank digit-circles__rank--low'>▼</span>}
                {isLow2  && <span className='digit-circles__rank digit-circles__rank--low2'>L2</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className='digit-circles__legend'>
        <span className='digit-circles__legend-item digit-circles__legend-item--green'>
          ● Highest {highDigits.length > 1 ? `(${highDigits.map(d => d.digit).join(',')})` : ''}
        </span>
        <span className='digit-circles__legend-item digit-circles__legend-item--blue'>● 2nd High</span>
        <span className='digit-circles__legend-item digit-circles__legend-item--red'>● Lowest</span>
        <span className='digit-circles__legend-item digit-circles__legend-item--yellow'>● 2nd Low</span>
        {lastDigit !== null && (
          <span className='digit-circles__legend-item digit-circles__legend-item--cursor'>
            ◎ Current: {lastDigit}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className='digit-circles__stats'>
        <div className='digit-circles__stat digit-circles__stat--green'>
          <span>HIGHEST</span>
          <strong>{highestPct?.toFixed(2) ?? '--'}%</strong>
          <em>{highDigits.map(d => d.digit).join(', ')}</em>
        </div>
        <div className='digit-circles__stat digit-circles__stat--blue'>
          <span>2ND HIGH</span>
          <strong>{secondHighPct?.toFixed(2) ?? '--'}%</strong>
          <em>{high2Digits.map(d => d.digit).join(', ') || '--'}</em>
        </div>
        <div className='digit-circles__stat digit-circles__stat--red'>
          <span>LOWEST</span>
          <strong>{lowestPct?.toFixed(2) ?? '--'}%</strong>
          <em>{lowDigits.map(d => d.digit).join(', ')}</em>
        </div>
        <div className='digit-circles__stat digit-circles__stat--yellow'>
          <span>2ND LOW</span>
          <strong>{secondLowPct?.toFixed(2) ?? '--'}%</strong>
          <em>{low2Digits.map(d => d.digit).join(', ') || '--'}</em>
        </div>
      </div>
    </div>
  );
};

export default DigitCircles;
