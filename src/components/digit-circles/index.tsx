// @ts-nocheck
import React from 'react';
import { DigitStat } from '@/hooks/useDigitStats';
import './digit-circles.scss';

interface DigitCirclesProps {
  digits: DigitStat[];
  lastDigit: number | null;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const DIGIT_COLORS: Record<number, string> = {
  3: '#D88B1F',
  6: '#42B883',
  8: '#42B883',
  7: '#E24A43',
  9: '#4E7CF5',
};

const getDigitColor = (digit: number, pct: number): string => {
  if (DIGIT_COLORS[digit]) return DIGIT_COLORS[digit];
  if (pct >= 11.5) return '#42B883';
  if (pct <= 8.5) return '#E24A43';
  return '#FFFFFF';
};

const getTextColor = (digit: number, pct: number): string => {
  const bg = getDigitColor(digit, pct);
  return bg === '#FFFFFF' ? '#1F2937' : '#FFFFFF';
};

const DigitCircles: React.FC<DigitCirclesProps> = ({ digits, lastDigit, showPercentage = true, size = 'md' }) => {
  const sorted = [...digits];
  const highest = Math.max(...digits.map(d => d.percentage));
  const lowest = Math.min(...digits.map(d => d.percentage));
  const secondHighest = [...digits].sort((a, b) => b.percentage - a.percentage)[1]?.percentage;
  const secondLowest = [...digits].sort((a, b) => a.percentage - b.percentage)[1]?.percentage;

  return (
    <div className={`digit-circles digit-circles--${size}`}>
      <div className='digit-circles__row'>
        {digits.map(({ digit, percentage }) => {
          const isLast = digit === lastDigit;
          const isHighest = percentage === highest;
          const isLowest = percentage === lowest;
          const bgColor = getDigitColor(digit, percentage);
          const txtColor = getTextColor(digit, percentage);

          return (
            <div key={digit} className={`digit-circles__wrapper ${isLast ? 'digit-circles__wrapper--current' : ''}`}>
              <div
                className='digit-circles__circle'
                style={{
                  background: bgColor,
                  border: isLast ? '3px solid #4C7DFF' : '2px solid #D9D9D9',
                  color: txtColor,
                  boxShadow: isLast ? '0 0 12px rgba(76,125,255,0.6)' : '0 2px 6px rgba(0,0,0,0.1)',
                }}
              >
                <span className='digit-circles__number'>{digit}</span>
                {showPercentage && <span className='digit-circles__percent'>{percentage.toFixed(1)}%</span>}
              </div>
              {isHighest && <span className='digit-circles__badge digit-circles__badge--high'>▲</span>}
              {isLowest && <span className='digit-circles__badge digit-circles__badge--low'>▼</span>}
            </div>
          );
        })}
      </div>
      <div className='digit-circles__stats'>
        <div className='digit-circles__stat digit-circles__stat--green'>
          <span>HIGHEST</span>
          <strong>{highest.toFixed(2)}%</strong>
        </div>
        <div className='digit-circles__stat digit-circles__stat--blue'>
          <span>2ND</span>
          <strong>{secondHighest?.toFixed(2)}%</strong>
        </div>
        <div className='digit-circles__stat digit-circles__stat--red'>
          <span>LOWEST</span>
          <strong>{lowest.toFixed(2)}%</strong>
        </div>
        <div className='digit-circles__stat digit-circles__stat--orange'>
          <span>2ND LOW</span>
          <strong>{secondLowest?.toFixed(2)}%</strong>
        </div>
      </div>
    </div>
  );
};

export default DigitCircles;
