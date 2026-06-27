// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { DigitStat } from '@/hooks/useDigitStats';
import './digit-circles.scss';

interface DigitCirclesProps {
  digits: DigitStat[];
  lastDigit: number | null;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Color scheme per spec:
 *  - GREEN  (#42B883) → highest %
 *  - BLUE   (#4E7CF5) → 2nd highest %
 *  - RED    (#E24A43) → lowest %
 *  - YELLOW (#F5C842) → 2nd lowest %
 *  - WHITE  (#FFFFFF) → all others
 */
function computeColors(digits: DigitStat[]): Map<number, string> {
  if (!digits.length) return new Map();

  const sorted = [...digits].sort((a, b) => b.percentage - a.percentage);
  const highest     = sorted[0];
  const secondHigh  = sorted[1];
  const sortedAsc   = [...digits].sort((a, b) => a.percentage - b.percentage);
  const lowest      = sortedAsc[0];
  const secondLow   = sortedAsc[1];

  const map = new Map<number, string>();
  digits.forEach(d => {
    if (d.digit === highest.digit)    map.set(d.digit, '#42B883'); // green
    else if (d.digit === secondHigh?.digit) map.set(d.digit, '#4E7CF5'); // blue
    else if (d.digit === lowest.digit)      map.set(d.digit, '#E24A43'); // red
    else if (d.digit === secondLow?.digit)  map.set(d.digit, '#F5C842'); // yellow
    else map.set(d.digit, '#FFFFFF');
  });
  return map;
}

function textColor(bg: string): string {
  // Yellow and white need dark text; others get white
  if (bg === '#FFFFFF' || bg === '#F5C842') return '#1a1a2e';
  return '#FFFFFF';
}

const DigitCircles: React.FC<DigitCirclesProps> = ({
  digits,
  lastDigit,
  showPercentage = true,
  size = 'md',
}) => {
  const colorMap = computeColors(digits);
  const sorted = [...digits].sort((a, b) => b.percentage - a.percentage);
  const highest    = sorted[0];
  const secondHigh = sorted[1];
  const sortedAsc  = [...digits].sort((a, b) => a.percentage - b.percentage);
  const lowest     = sortedAsc[0];
  const secondLow  = sortedAsc[1];

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
    const r  = circRect.width / 2 + 6; // 6px padding around circle
    cursorRef.current.style.transform = `translate(${cx}px, ${cy}px)`;
    cursorRef.current.style.width  = `${r * 2}px`;
    cursorRef.current.style.height = `${r * 2}px`;
    cursorRef.current.style.marginLeft = `${-r}px`;
    cursorRef.current.style.marginTop  = `${-r}px`;
    cursorRef.current.style.opacity = '1';
  }, [lastDigit, digits, size]);

  return (
    <div className={`digit-circles digit-circles--${size}`}>
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
            const isHigh  = digit === highest?.digit;
            const isHigh2 = digit === secondHigh?.digit;
            const isLow   = digit === lowest?.digit;
            const isLow2  = digit === secondLow?.digit;

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
                {isHigh  && <span className='digit-circles__rank digit-circles__rank--1st'>1st</span>}
                {isHigh2 && <span className='digit-circles__rank digit-circles__rank--2nd'>2nd</span>}
                {isLow   && <span className='digit-circles__rank digit-circles__rank--low'>LOW</span>}
                {isLow2  && <span className='digit-circles__rank digit-circles__rank--low2'>L2</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className='digit-circles__legend'>
        <span className='digit-circles__legend-item digit-circles__legend-item--green'>● Highest</span>
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
          <strong>{highest?.percentage.toFixed(2) ?? '--'}%</strong>
          <em>{highest?.digit}</em>
        </div>
        <div className='digit-circles__stat digit-circles__stat--blue'>
          <span>2ND HIGH</span>
          <strong>{secondHigh?.percentage.toFixed(2) ?? '--'}%</strong>
          <em>{secondHigh?.digit}</em>
        </div>
        <div className='digit-circles__stat digit-circles__stat--red'>
          <span>LOWEST</span>
          <strong>{lowest?.percentage.toFixed(2) ?? '--'}%</strong>
          <em>{lowest?.digit}</em>
        </div>
        <div className='digit-circles__stat digit-circles__stat--yellow'>
          <span>2ND LOW</span>
          <strong>{secondLow?.percentage.toFixed(2) ?? '--'}%</strong>
          <em>{secondLow?.digit}</em>
        </div>
      </div>
    </div>
  );
};

export default DigitCircles;
