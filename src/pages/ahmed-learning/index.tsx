import React, { useState } from 'react';
import './ahmed-learning.scss';

const TOPICS = [
    {
        id: 'intro',
        icon: '🎓',
        title: 'Introduction to AHMEDSYNTRADERSITE',
        color: '#00ff88',
        content: [
            { heading: 'Welcome', text: 'AHMEDSYNTRADERSITE is an advanced AI-powered trading platform built on Deriv\'s infrastructure. It gives you access to volatility indices, digit trading, and automated bot strategies.' },
            { heading: 'Key Features', text: '• Digit Circle Analysis — real-time digit frequency tracking\n• Free Bots — pre-built XML trading strategies\n• Hedge Trading — simultaneous LEG A and LEG B contracts\n• SpeedLab — ultra-fast 1-tick trading\n• AI Scanner — market opportunity detection using smart rules\n• Manual Trader — one-click contract execution' },
        ],
    },
    {
        id: 'markets',
        icon: '📊',
        title: 'Deriv Markets: Volatility Indices',
        color: '#06b6d4',
        content: [
            { heading: 'Synthetic Indices', text: 'Deriv offers 24/7 markets that are not influenced by real-world events:\n• Volatility 10 (V10) — low volatility, slow moves\n• Volatility 25 (V25) — moderate volatility\n• Volatility 50 (V50) — balanced\n• Volatility 75 (V75) — high volatility\n• Volatility 100 (V100) — extreme volatility\n• 1-second series (1HZ) — faster settlement' },
            { heading: 'Jump Indices', text: 'Jump indices have occasional large price jumps:\n• Jump 10, 25, 50, 75, 100\nBest for Over/Under strategies due to predictable digit patterns.' },
        ],
    },
    {
        id: 'digits',
        icon: '🔢',
        title: 'Digit Trading Strategies',
        color: '#8b5cf6',
        content: [
            { heading: 'Even / Odd', text: 'Predict whether the last digit of the exit spot is even (0,2,4,6,8) or odd (1,3,5,7,9). Win rate should be near 50%. Use when digit distribution is skewed.' },
            { heading: 'Matches / Differs', text: 'Predict the exact last digit of the exit spot. Payout is ~900% for Matches (1 in 10 chance). Differs wins 9/10 times for ~5% payout.' },
            { heading: 'Over / Under', text: 'Over N: exit digit must be > N. Under N: exit digit must be < N.\n\nStrong Over entries: 3, 4, 1\nWeak Over entries: 8, 7, 0\nStrong Under entries: 9, 6, 2\nWeak Under: 5' },
        ],
    },
    {
        id: 'martingale',
        icon: '📈',
        title: 'Martingale Strategy',
        color: '#f59e0b',
        content: [
            { heading: 'How It Works', text: 'After each loss, multiply your stake by a factor (e.g., 2.2x). This recovers all previous losses plus a profit on the next win.' },
            { heading: 'Example', text: 'Stake: $0.50 → loss → $1.10 → loss → $2.42 → WIN → recover all losses + profit.' },
            { heading: 'Risk Warning', text: '⚠️ Martingale requires a large bankroll. A losing streak of 10+ consecutive trades can wipe your account. Always set a Stop Loss.' },
        ],
    },
    {
        id: 'under_market',
        icon: '⬇',
        title: 'Under Market Analysis (PDF Rules)',
        color: '#ef4444',
        content: [
            { heading: 'Under 9', text: 'Trade when digit 9 is below 10%. Entry: digits 9 or 0. Use 1 tick (plain markets) or 2 ticks (1s markets).' },
            { heading: 'Under 8', text: 'Trade when digits 8 and 9 are below 10% AND digit 7 ≥ 10.3% (shield). Entry: 7 (10.4%+), 4 (10.5%+), 6 (10.2%+), 9, 0, 1.' },
            { heading: 'Under 7/6/5', text: 'Each step adds one more digit below 10% threshold. The shield digit provides protection. Prefer entries with percentages well above 10.3%.' },
        ],
    },
    {
        id: 'over_market',
        icon: '⬆',
        title: 'Over Market Analysis (PDF Rules)',
        color: '#22c55e',
        content: [
            { heading: 'Over 0', text: 'Trade when digit 0 < 10%. Entry: digits 0 or 9. 1 tick (plain), 2 ticks (1s markets).' },
            { heading: 'Over 1-4', text: 'Each step: target digit AND all below it must be < 10%. Next digit must be ≥ 10.3% as shield. Stronger shield = better setup.' },
            { heading: 'Shield Strength', text: 'Below 9.8%: Very Strong Setup\n9.8-10.0%: Good Setup\n10.0-10.2%: Neutral\n10.3-10.5%: Strong Shield\nAbove 10.6%: Excellent Shield\n\n✅ Trade only when shield digit ≥ 10.3%\n❌ Avoid when all digits clustered 9.8-10.2%' },
        ],
    },
    {
        id: 'hedge',
        icon: '⚖',
        title: 'Hedge Trading Guide',
        color: '#ec4899',
        content: [
            { heading: 'What is Hedging?', text: 'Hedging places two simultaneous opposing contracts. Example: Buy DIGITEVEN (LEG A) and DIGITODD (LEG B) at the same entry tick. One leg always wins.' },
            { heading: 'Same Entry/Exit', text: 'On 1-tick contracts, both legs share the SAME entry tick and exit tick. The winning leg covers the loss of the other with profit if stakes are calculated correctly.' },
            { heading: 'Over/Under Hedge', text: 'Buy Over 4 and Under 5 simultaneously — when the last digit is 5, 6, 7, 8, or 9, Over 4 wins. When it is 0-4, Under 5 wins. Probability ~50/50 each.' },
        ],
    },
    {
        id: 'bots',
        icon: '🤖',
        title: 'Using the Free Bots',
        color: '#14b8a6',
        content: [
            { heading: 'Ahmed SYN Even/Odd Killer v1.2', text: 'Settings:\n• Symbol: V25 1s (1HZ25V)\n• Type: Even/Odd\n• Duration: 1 tick\n• Initial stake: $0.50\n• Martingale: 2.2x\n• Take profit: $2.00\n• Stop loss: $1000' },
            { heading: 'Speed Bot v2.2', text: 'High-speed digit bot with configurable entry signals, martingale recovery, and automatic take-profit/stop-loss management.' },
            { heading: 'Loading a Bot', text: '1. Go to Free Bots tab\n2. Click "▶ Load Bot" on any preset bot\n3. Bot XML loads into the Blockly workspace\n4. Click ▶ Run to start trading' },
        ],
    },
];

const AhmedLearning: React.FC = () => {
    const [activeTopic, setActiveTopic] = useState('intro');
    const topic = TOPICS.find(t => t.id === activeTopic) || TOPICS[0];

    return (
        <div className='ahmed-learning'>
            <div className='ahmed-learning__sidebar'>
                <div className='ahmed-learning__sidebar-title'>
                    <span>📚</span> Learning Hub
                </div>
                {TOPICS.map(t => (
                    <button
                        key={t.id}
                        className={`ahmed-learning__nav-item ${activeTopic === t.id ? 'active' : ''}`}
                        style={activeTopic === t.id ? { borderColor: t.color, color: t.color } : {}}
                        onClick={() => setActiveTopic(t.id)}
                    >
                        <span className='ahmed-learning__nav-icon'>{t.icon}</span>
                        <span>{t.title}</span>
                    </button>
                ))}
            </div>

            <div className='ahmed-learning__content'>
                <div className='ahmed-learning__topic-header' style={{ borderColor: topic.color }}>
                    <span className='ahmed-learning__topic-icon'>{topic.icon}</span>
                    <div>
                        <h2 style={{ color: topic.color }}>{topic.title}</h2>
                    </div>
                </div>

                <div className='ahmed-learning__sections'>
                    {topic.content.map((section, i) => (
                        <div key={i} className='ahmed-learning__section' style={{ borderColor: `${topic.color}30` }}>
                            <h3 className='ahmed-learning__section-heading' style={{ color: topic.color }}>
                                {section.heading}
                            </h3>
                            <div className='ahmed-learning__section-text'>
                                {section.text.split('\n').map((line, j) => (
                                    <p key={j}>{line}</p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className='ahmed-learning__tip'>
                    <span>💡</span>
                    <p>Use the <strong>AI Scanner</strong> (floating panel on the left) to automatically detect the best market setup based on the PDF rules above. The scanner will suggest when to load the Ahmed SYN bot.</p>
                </div>
            </div>
        </div>
    );
};

export default AhmedLearning;
