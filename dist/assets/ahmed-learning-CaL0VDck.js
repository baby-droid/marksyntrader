import{o as e}from"./rolldown-runtime-DAXXjFlN.js";import{t}from"./react-Bb3IsNbi.js";import{t as n}from"./jsx-runtime-CtMZ-PAS.js";var r=e(t()),i=n(),a=[{id:`intro`,icon:`🎓`,title:`Introduction to AHMED SYN TRADER`,color:`#00ff88`,content:[{heading:`Welcome`,text:`AHMED SYN TRADER is an advanced AI-powered trading platform built on Deriv's infrastructure. It gives you access to volatility indices, digit trading, and automated bot strategies — all in one workspace.`},{heading:`Key Pages`,text:`• Dashboard — overview of your account, quick stats, and bot shortcuts
• Manual Trader — one-click contract execution with digit circle analysis
• Bulk Trade — execute many contracts simultaneously at the same entry spot
• Speed Lab — ultra-fast 1-tick trading for experienced traders
• Auto Trades — AI bots (AutoDiffer, Over/Under, O5U4, O2U7) trading for you
• Scalper Bots — entry signal detection + Bot Builder XML execution
• Free Bots — pre-built XML strategies (Even/Odd Killer, Speed Bot, etc.)
• Pro Hedge — simultaneous LEG A + LEG B contracts
• D-Circles — digit frequency analysis and visualization
• Copy Trading — mirror your trades to up to 10 follower accounts
• Reports — P&L history, open positions, and full account statement
• Tutorial — this page with comprehensive guides`},{heading:`Getting Started`,text:`1. Log in with your Deriv API token (Settings → API Token with Read + Trade scope)
2. Select your market in Manual Trader (start with V100 1s for the fastest ticks)
3. Watch the digit circles load — they show the last 1000-tick frequency
4. Place your first trade using a Buy button in the trade panel
5. Use the Reports page to review your trade history`}]},{id:`markets`,icon:`📊`,title:`Deriv Markets: Volatility Indices`,color:`#06b6d4`,content:[{heading:`Synthetic Indices`,text:`Deriv offers 24/7 markets not influenced by real-world events:
• Volatility 10 (V10) — low volatility, slow moves, 2 decimal places
• Volatility 25 (V25) — moderate volatility, 2 decimal places
• Volatility 50 (V50) — balanced volatility, 2 decimal places
• Volatility 75 (V75) — high volatility, 2 decimal places
• Volatility 100 (V100) — extreme volatility, 2 decimal places
• 1-second series (1HZ) — same markets but settle every 1 second; 3 decimal places`},{heading:`Jump Indices`,text:`Jump indices have occasional large price jumps:
• Jump 10, 25, 50, 75, 100
Best for Over/Under strategies due to more predictable digit patterns after jump events.`},{heading:`Pip Size & Digits`,text:`The "last digit" is the final decimal place of the price:
• V10/V25/V50/V75/V100 → pip_size = 2 (e.g. 9395.27 → digit 7)
• 1s markets (1HZ series) → pip_size = 3 (e.g. 9395.248 → digit 8)
The platform auto-detects pip_size from the first live tick and recomputes digit history accordingly.`}]},{id:`contract-types`,icon:`📜`,title:`Contract Types & How They Work`,color:`#f59e0b`,content:[{heading:`Rise / Fall (Call / Put)`,text:`Predict whether the exit PRICE will be higher (Rise) or lower (Fall) than the entry spot after N ticks.
• Duration: 1–10 ticks
• Works on all markets
• Win probability: ~50/50 on a fair market
• Payout: ~95% of stake on win`},{heading:`Even / Odd`,text:`Predict whether the LAST DIGIT of the exit price is even (0,2,4,6,8) or odd (1,3,5,7,9).
• Theoretical win probability: 50%
• Payout: ~95% of stake
• Best used when digit distribution is skewed toward one side`},{heading:`Match / Differ`,text:`MATCH: exit digit must equal your chosen digit. Win probability ~10%, payout ~900%.
DIFFER: exit digit must NOT equal your chosen digit. Win probability ~90%, payout ~5%.
• Use Differ with the LEAST frequent digit for highest win rate
• Use Match as a high-risk, high-reward play`},{heading:`Over / Under`,text:`OVER N: exit digit must be STRICTLY GREATER than N.
UNDER N: exit digit must be STRICTLY LESS than N.
• Over 5: digits 6,7,8,9 win → ~40% chance
• Under 5: digits 0,1,2,3,4 win → ~50% chance
• Over 4: digits 5,6,7,8,9 win → ~50% chance
• Use digit circle analysis to find the best barrier`},{heading:`Ticks & Settlement`,text:`Duration in ticks means how many price updates (ticks) occur before the contract expires.
• 1 tick: settles on the very next price update after entry
• 5 ticks: the 5th price update after entry is the exit spot
• 1s markets update every ~1 second; plain markets update ~2-4 times per second
• T1 = first tick after entry, T2 = second tick, etc.
• The PLATFORM skips the entry tick automatically for 1s markets to get a clean T1`}]},{id:`manual-trader`,icon:`🖱️`,title:`Manual Trader — How to Use`,color:`#3b82f6`,content:[{heading:`The Digit Circle Panel`,text:`The 10 circles (0–9) show the frequency of each last digit over the last 1000 ticks:
• GREEN circle = highest frequency (most common digit)
• BLUE circle = 2nd highest
• AMBER circle = 2nd lowest
• RED circle = lowest frequency (rarest digit)
• Dark navy circles = neutral frequency

Use this to pick your DIFFER barrier (choose the RED/rarest digit) or your OVER/UNDER barrier (avoid the red digit for OVER).`},{heading:`The Live SVG Chart`,text:`The price chart above the circles shows the last 120 price ticks as a line graph. Watch the trend:
• Flat = sideways market (good for Even/Odd)
• Sharp up = momentum (consider Rise contracts)
• Sharp down = momentum (consider Fall contracts)
• The current digit is shown at the top right with its digit value`},{heading:`Trade Panel (Right Side)`,text:`Configure your trade:
1. Duration — number of ticks (1, 2, 3, 5, or 10)
2. Stake — amount per contract
3. Contract Type — Rise/Fall, Even/Odd, Over/Under, Match/Differ
4. Barrier — for Over/Under/Match/Differ, select digit 0–9
5. Click the BUY button (green = Rise/Over/Even/Match, red = Fall/Under/Odd/Differ)`},{heading:`Bulk Buy (in Manual Trader)`,text:`The trade panel has a "Bulk" toggle. Enable it to fire N identical contracts simultaneously at the same entry spot. Configure the count (2–50) then click Execute. Each contract is tracked individually in the Positions panel below.`},{heading:`Positions Panel`,text:`The bottom section shows your current open positions:
• Entry spot, current spot, and predicted exit spot
• Live P&L updates as the contract progresses
• After settlement: final P&L shown in green (WIN) or red (LOSS)
• Positions auto-clear after a few seconds`},{heading:`Tips for Manual Trading`,text:`✅ Always watch the digit circles for at least 30 seconds before trading
✅ For DIFFER, always pick the RED (rarest) digit as your barrier
✅ For UNDER, avoid markets where digit 0 is very high — means more high digits incoming
✅ Use 1-tick duration on 1s markets for fastest settlement
✅ For Rise/Fall, use 3–5 ticks for more room to breathe
❌ Never chase losses by increasing stake aggressively without a system
❌ Avoid trading during market "dead zones" — watch for digit 9 appearing repeatedly`}]},{id:`scalper-bots`,icon:`⚙️`,title:`Scalper Bots — Configuration Guide`,color:`#8b5cf6`,content:[{heading:`What Are Scalper Bots?`,text:`Scalper Bots detect entry signals from live tick data, then fire the real Bot Builder XML bot when an entry is confirmed. You configure the detection rules; the Bot Builder executes the actual contracts with full Martingale support.`},{heading:`Strategy Conditions — Algorithm Options`,text:`Each condition has an Algorithm selector:
• LDP (Least Digit Pattern): detects when a digit appears rarely — fires on confirmed low-frequency digit
• Market %: fires when a digit's frequency goes below a threshold you set
• Sequence Radar: fires when N consecutive digits match a pattern (e.g. all > 5)
• Complex Patterns: multi-step pattern detection with configurable depth
• Entry Point Pattern (EPP): momentum-based entry using tick velocity
• NDP: "No Digit Pattern" — contrarian mode, fires when EXPECTED pattern breaks

Mix multiple conditions in one session by adding rows. All active conditions compete; whichever triggers first wins the execution slot.`},{heading:`Risk Manager (RM)`,text:`Enable the Risk Manager panel to add a safety ceiling on martingale:
• Base Stake: the starting stake for every new cycle
• Multiplier: how much stake grows after each loss (e.g. 2.2×)
• Override Limit: if stake would exceed this, reset to base instead of multiplying
• Activate Limit: number of consecutive losses before RM kicks in
• Inject ON: also applies the override ceiling to the standard martingale from the Bot Builder XML`},{heading:`VPS Mode`,text:`VPS Mode keeps the scalper running 24/7 without manual restarts:
• Auto Restart: when bot stops (Take Profit or Stop Loss hit), auto-restart after N seconds
• Take Profit / Stop Loss: session-level limits in USD — bot stops when either is breached
• Max Runs: stop after N successful entry signals
• Health Monitor: checks every 60 seconds that the WebSocket is still alive

Enable VPS Mode when running unattended for long periods.`},{heading:`Market & Duration`,text:`Select your market (V10, V25, V50, V75, V100, 1s variants, Jump indices) and tick duration:
• 1 tick: ultra-fast, highest risk, lowest payout per win
• 2–3 ticks: balanced, recommended for Over/Under
• 5 ticks: slower, more confirmation time

The scalper patches the selected market and duration into the Bot Builder XML before running — no need to manually edit the bot.`},{heading:`Multi-Contract Mode`,text:`Enable Multi-Trade to fire N simultaneous contracts per entry signal. Each fires independently and settles independently. Combined with Martingale, this increases coverage of the entry tick.`}]},{id:`auto-trades`,icon:`🤖`,title:`Auto Trades — AI Bots Guide`,color:`#ec4899`,content:[{heading:`AutoDiffer`,text:`Analyzes the last 50 digits and identifies the LEAST frequent digit. Places a DIGITDIFF contract on that digit — since it appears least often, the probability that the next digit DIFFERS from it is highest (~90%+ in ideal conditions).

Market: V100 (1s) | Duration: 1 tick
Best with: low stake + high martingale multiplier (e.g. 2.2×)
Caution: frequency can shift — stops at Take Profit or Stop Loss`},{heading:`Auto Over/Under`,text:`Looks at the last 20 digits. If more than 10 of them are > 4 (over-bias), it trades DIGITOVER 2 (wins on 3,4,5,6,7,8,9 = 70% of outcomes). Otherwise trades DIGITUNDER 7 (wins on 0,1,2,3,4,5,6 = 70% of outcomes).

Market: V25 (1s) | Duration: 1 tick
Best for: trending digit markets`},{heading:`Auto O5 U4`,text:`Compares Over 5 count vs Under 4 count in last 20 digits. Trades whichever has higher recent frequency.

Market: V50 (1s) | Duration: 1 tick
Note: Win prob for both sides ~40–50% — relies on streaks`},{heading:`Auto O2 U7 (Recovery)`,text:`Hybrid strategy: starts with DIGITOVER 2 (wins on 3–9, ~70%). On any loss, switches to DIGITUNDER 5 for recovery.

Market: V75 (1s) | Duration: 1 tick
Good for: aggressive recovery mode`},{heading:`Smart Trading (Money Laundering Bot)`,text:`Combined mode: AI analyzes depth N of live digits, picks least-frequent, then runs DIGITDIFF with martingale. Configurable:
• Depth (how many recent digits to analyze)
• Symbol (any market)
• Martingale multiplier
• Take Profit / Stop Loss

All bots use your MAIN CONNECTED ACCOUNT (real or demo, whichever is active). Switch accounts in the header before starting.`},{heading:`When to Run Auto Bots`,text:`✅ Run when digit distribution is clearly uneven (one digit below 8%)
✅ Run with small stake (0.35–1.00 USD) during learning phase
✅ Set Stop Loss = 3× your stake to prevent runaway losses
❌ Do not run multiple bots simultaneously on the same market
❌ Stop bots during major market resets (usually around midnight server time)`}]},{id:`free-bots`,icon:`🆓`,title:`Free Bots & Bot Builder`,color:`#14b8a6`,content:[{heading:`Available Free Bots`,text:`• Ahmed SYN Even/Odd Killer v1.2 — Even/Odd on V25 1s, martingale 2.2×
• Speed Bot v2.2 — high-frequency digit bot with configurable signals
• Over 4 Under 5 v1.1 — alternates Over/Under with pattern detection
• Differ Bot v3 — DIGITDIFF on least-frequent digit, auto-selects barrier
• Hedge Bot — simultaneous Even + Odd for guaranteed partial coverage`},{heading:`Loading a Free Bot`,text:`1. Go to the Free Bots tab
2. Browse the folder grid
3. Click "▶ Load Bot" on any preset bot
4. The XML loads into the Bot Builder workspace automatically
5. Click ▶ Run in the Run Panel at the bottom to start trading
6. Configure Take Profit, Stop Loss, and Duration in the Run Panel before starting`},{heading:`Bot Builder (Blockly)`,text:`The Bot Builder is a visual drag-and-drop programming environment:
• Blocks represent actions: Buy, Sell, If/Else, Loop, Set Variable
• Connect blocks to define your strategy logic
• You can modify any loaded bot by editing its blocks
• Click "Save Bot" to save your custom strategy as an XML file
• Load your saved bot via File → Open from the toolbar`},{heading:`Key Bot Settings (Run Panel)`,text:`Before clicking Run, configure in the Run Panel:
• Initial stake — how much per contract
• Duration — number of ticks
• Take Profit — stop when profit reaches this amount
• Stop Loss — stop when loss reaches this amount
• Max stake — martingale ceiling (prevent runaway stake growth)
• Loss type — how to increase stake on loss (Martingale or D'Alembert)`}]},{id:`bulk-trade`,icon:`⚡`,title:`Bulk Trade — How to Use`,color:`#f97316`,content:[{heading:`What is Bulk Trade?`,text:`Bulk Trade fires N identical contracts simultaneously at the SAME entry tick. All contracts share the same entry spot, so they live or die together — it's like amplifying your position at a single moment.`},{heading:`Configuration`,text:`• Market — choose your synthetic index
• Trade Type — Rise/Fall, Even/Odd, Over/Under, Match/Differ
• Prediction — for digit trades, select barrier 0–9
• Ticks Duration — how long each contract lasts
• Contracts Count — how many to fire at once (2–100)
• Stake per Contract — individual stake; total = count × stake`},{heading:`Martingale on Loss`,text:`Toggle Martingale ON (green button) to automatically increase the stake for the next batch after a net-loss batch.
• Multiplier: how much to increase stake (e.g. 2.0× = double)
• After a net-win batch, stake resets to your original value
• The summary bar always shows the CURRENT active stake vs original`},{heading:`Execute Button`,text:`Click ⚡ Execute to fire all contracts. The button changes to "Sending N contracts…" while waiting. Each contract settles independently and appears in the Trade Log below with W/L result and P/L.`},{heading:`When to Use Bulk Trade`,text:`✅ Use when you're confident in the entry signal (e.g. digit frequency strongly favors DIFFER)
✅ Combine with small individual stakes for controlled exposure
✅ Use 1-tick duration on 1s markets for fastest settlement
❌ Never use maximum count with large stakes — total exposure grows rapidly
❌ Use with caution on Rise/Fall — all contracts share the same entry price`}]},{id:`speed-lab`,icon:`🚀`,title:`Speed Lab — Ultra-Fast Trading`,color:`#ef4444`,content:[{heading:`Speed Modes`,text:`• Normal: waits for each contract to settle before placing the next one. Safest.
• Crazy: fires contracts without waiting for settlement, with a small cap on in-flight contracts. Higher throughput.
• Turbo: zero-delay fire-and-forget, no in-flight cap. Maximum speed, maximum risk.

Start with Normal until you understand how the bot behaves, then experiment with Crazy.`},{heading:`Configuration`,text:`• Market — select any supported symbol
• Strategy — preset patterns (LDP, Over/Under, Even/Odd streaks)
• Stake — per-contract stake
• Duration — ticks per contract
• Take Profit / Stop Loss — session limits in USD
• Martingale — multiply stake after loss, reset after win`},{heading:`When to Use Speed Lab`,text:`✅ Use on 1s markets (1HZ series) where settlement happens every ~1 second
✅ Use Crazy mode when you want to cover many ticks quickly
✅ Set Take Profit to a small realistic target (e.g. $5 per session)
❌ Turbo mode can send hundreds of contracts per minute — use with extreme caution
❌ Do not use with large stakes in Crazy/Turbo mode`}]},{id:`hedge`,icon:`⚖️`,title:`Pro Hedge — Simultaneous Legs`,color:`#ec4899`,content:[{heading:`What is Hedging?`,text:`Hedging places two simultaneous OPPOSING contracts at the same entry tick. Example: Buy DIGITEVEN (LEG A) and DIGITODD (LEG B). One leg ALWAYS wins since every digit is either even or odd.`},{heading:`Even/Odd Hedge (100% Coverage)`,text:`LEG A: DIGITEVEN, LEG B: DIGITODD
• Both fire at the same entry tick
• One wins, one loses
• Net P/L depends on payout rates
• Even: wins on 0,2,4,6,8 (~50%). Odd: wins on 1,3,5,7,9 (~50%)
• Goal: the winning payout exceeds the losing stake

Best used on V25 or V50 1s for balanced payouts.`},{heading:`Over/Under Hedge`,text:`LEG A: DIGITOVER 4, LEG B: DIGITUNDER 5
• Over 4 wins on digits 5,6,7,8,9
• Under 5 wins on digits 0,1,2,3,4
• Together: 100% coverage (OVER4 wins on 5+ and UNDER5 wins on 0–4)
• On digit 5 exactly: both win`},{heading:`Stake Calculation`,text:`To profit from hedging:
1. Calculate payout of LEG A: stake × payout_multiplier
2. LEG B stake = LEG A payout − LEG B payout (so net profit > 0 regardless of outcome)
Example: LEG A stake $1.00, payout 95% → $0.95 profit. LEG B stake $0.97 to ensure both sides profit.

Always simulate before trading with real funds.`}]},{id:`copy-trading`,icon:`🔄`,title:`Copy Trading — Setup Guide`,color:`#22d3ee`,content:[{heading:`Overview`,text:`Copy Trading mirrors your trades to up to 10 follower accounts. When you buy a contract on your master account, each active follower automatically places the same contract with a scaled stake.`},{heading:`Adding a Follower`,text:`1. Get the follower's Deriv API token (they must create one with Read + Trade scope)
2. In Copy Trading, paste the token in the input box
3. Set the stake ratio (e.g. 1.0 = same stake, 0.5 = half stake, 2.0 = double stake)
4. Click "Add & Join"
5. The system verifies the token, links the account, and auto-starts copying

Important: The token MUST have Trade scope. Read-only tokens are rejected.`},{heading:`Copy Modes`,text:`• Real → Real: your REAL account trades are mirrored to follower REAL accounts
• Demo → Real: your DEMO signals are mirrored to follower REAL accounts (for paper testing)

Always test with Demo → Real mode before enabling Real → Real.`},{heading:`Managing Followers`,text:`• Each follower card shows login ID, currency, balance, and trades replicated
• Adjust ratio per follower at any time without stopping
• Remove a follower with ✕ — their ongoing contracts continue but no new ones are placed
• Max 10 followers at once`}]},{id:`reports`,icon:`📋`,title:`Reports Page — Guide`,color:`#a78bfa`,content:[{heading:`P&L History Tab`,text:`Shows your settled contracts from the Deriv profit_table API.
• Grouped by day with daily totals
• Each row shows: Type, Buy time, Sell time, Entry spot, Exit spot, P/L
• Filter by date range and limit (25–200 records)
• Summary cards: Total P/L, Total Trades, Wins, Losses, Win Rate

This is the same data shown in Deriv.com's Reports → Profit Table.`},{heading:`Open Positions Tab`,text:`Live-streaming view of all currently open contracts.
• Updates in real-time via the proposal_open_contract subscription
• Shows entry spot, current price, and live P/L
• Contracts disappear ~1 second after settling
• Click Refresh to reconnect the stream if the Live badge turns grey`},{heading:`Statement Tab`,text:`Full account ledger from the Deriv statement API.
• Includes all actions: buy, sell, deposit, withdrawal, adjustment
• Shows balance after each transaction
• Use date filters to narrow down to specific sessions

This matches Deriv.com's Reports → Statement.`},{heading:`Reading P/L Values`,text:`• Positive P/L (green) = profit on that contract
• Negative P/L (red) = loss
• Win Rate = (wins / total trades) × 100%
• A win rate above 52% is needed to profit over time with 95% payout contracts`}]},{id:`analysis`,icon:`🔍`,title:`How to Analyse & Confirm Entries`,color:`#84cc16`,content:[{heading:`Step 1: Read the Digit Circles`,text:`Open Manual Trader or D-Circles and watch the digit circles for 30–60 seconds.
Look for:
• Any digit below 8% (RED circle) → strong DIFFER target
• Any digit above 12% (GREEN circle) → avoid as OVER/UNDER target
• Even distribution (9–11% each) → avoid digit trades, use Rise/Fall
• Two or more digits below 9% → look for OVER/UNDER with high barrier`},{heading:`Step 2: Check Price Momentum`,text:`Watch the SVG chart for price direction:
• 3+ consecutive rising ticks → consider RISE (Call) contract
• 3+ consecutive falling ticks → consider FALL (Put) contract
• Sideways flat → use digit trades (Even/Odd, Differ)
• Sudden spike up then reversal → good entry for FALL`},{heading:`Step 3: Confirm with PDF Rules (Under/Over)`,text:`For UNDER N trades:
• Target digit AND all below it must be below 10%
• The SHIELD digit (next digit above target) must be ≥ 10.3%
• Stronger shield (10.5%+) = better entry signal

For OVER N trades:
• Same rules in reverse — target and all above must be low
• Shield must be ≥ 10.3% on the lower side`},{heading:`Step 4: Set Duration`,text:`Choose ticks based on confidence and market speed:
• 1 tick: highest risk, fastest settlement, no time to recover
• 2–3 ticks: slight buffer, good for Over/Under (digit can shift)
• 5–10 ticks: for Rise/Fall trend trades

On 1s markets, the platform automatically skips the entry tick (T0) and starts counting from T1.`},{heading:`Step 5: Execute and Track`,text:`1. Set your stake in the trade panel
2. Click the BUY button (or Execute in Bulk Trade)
3. The digit circle of the predicted digit flashes during the trade
4. The triangle indicator (▼) shows above the current live digit
5. Watch the Positions panel for settlement
6. Review in Reports after the session`}]},{id:`digits`,icon:`🔢`,title:`Digit Trading Strategies`,color:`#8b5cf6`,content:[{heading:`Even / Odd`,text:`Predict whether the last digit of the exit spot is even (0,2,4,6,8) or odd (1,3,5,7,9). Win rate should be near 50%. Use when digit distribution is skewed.`},{heading:`Matches / Differs`,text:`Predict the exact last digit of the exit spot. Payout is ~900% for Matches (1 in 10 chance). Differs wins 9/10 times for ~5% payout. Always Differ on the LEAST frequent digit (RED circle).`},{heading:`Over / Under`,text:`Over N: exit digit must be > N. Under N: exit digit must be < N.

Strong Over entries: barrier 3, 4, 1
Weak Over entries: barrier 8, 7, 0
Strong Under entries: barrier 9, 6, 2
Weak Under: barrier 5`}]},{id:`martingale`,icon:`📈`,title:`Martingale & Risk Management`,color:`#f59e0b`,content:[{heading:`How Martingale Works`,text:`After each loss, multiply your stake by a factor (e.g. 2.2×). This recovers all previous losses plus a profit on the next win.

Example: $0.50 → loss → $1.10 → loss → $2.42 → WIN → profit $0.24 and recover both losses.`},{heading:`Choosing a Multiplier`,text:`• 1.5× — slower stake growth, more sustainable, lower recovery
• 2.0× — standard, recovers in 1 win after 1 loss
• 2.2× — popular choice for ~95% payout contracts
• 3.0×+ — aggressive, very high risk

Rule: your bankroll should support at least 8 consecutive losses at your multiplier before hitting zero.`},{heading:`Stop Loss is Mandatory`,text:`Never run a martingale bot without a Stop Loss.
• Set Stop Loss = 20–50× your initial stake
• Set Take Profit = 5–10× your initial stake per session
• After hitting either limit, stop and restart fresh

⚠️ A losing streak of 10+ consecutive trades at 2.2× multiplier from $0.50 stake reaches $290 per trade. Without Stop Loss, this can empty your account.`},{heading:`D'Alembert Alternative`,text:`D'Alembert increases stake by 1 unit after loss, decreases by 1 unit after win — much slower escalation than Martingale. Lower recovery speed but safer for longer sessions. Available in the Bot Builder Run Panel.`}]},{id:`under_market`,icon:`⬇`,title:`Under Market Analysis (PDF Rules)`,color:`#ef4444`,content:[{heading:`Under 9`,text:`Trade when digit 9 is below 10%. Entry: digits 9 or 0. Use 1 tick (plain markets) or 2 ticks (1s markets).`},{heading:`Under 8`,text:`Trade when digits 8 and 9 are below 10% AND digit 7 ≥ 10.3% (shield). Entry: 7 (10.4%+), 4 (10.5%+), 6 (10.2%+), 9, 0, 1.`},{heading:`Under 7/6/5`,text:`Each step adds one more digit below 10% threshold. The shield digit provides protection. Prefer entries with percentages well above 10.3%.`}]},{id:`over_market`,icon:`⬆`,title:`Over Market Analysis (PDF Rules)`,color:`#22c55e`,content:[{heading:`Over 0`,text:`Trade when digit 0 < 10%. Entry: digits 0 or 9. 1 tick (plain), 2 ticks (1s markets).`},{heading:`Over 1-4`,text:`Each step: target digit AND all below it must be < 10%. Next digit must be ≥ 10.3% as shield. Stronger shield = better setup.`},{heading:`Shield Strength`,text:`Below 9.8%: Very Strong Setup
9.8-10.0%: Good Setup
10.0-10.2%: Neutral
10.3-10.5%: Strong Shield
Above 10.6%: Excellent Shield

✅ Trade only when shield digit ≥ 10.3%
❌ Avoid when all digits clustered 9.8-10.2%`}]},{id:`bots`,icon:`🤖`,title:`Using the Free Bots`,color:`#14b8a6`,content:[{heading:`Ahmed SYN Even/Odd Killer v1.2`,text:`Settings:
• Symbol: V25 1s (1HZ25V)
• Type: Even/Odd
• Duration: 1 tick
• Initial stake: $0.50
• Martingale: 2.2×
• Take profit: $2.00
• Stop loss: $1000`},{heading:`Speed Bot v2.2`,text:`High-speed digit bot with configurable entry signals, martingale recovery, and automatic take-profit/stop-loss management.`},{heading:`Loading a Bot`,text:`1. Go to Free Bots tab
2. Click "▶ Load Bot" on any preset bot
3. Bot XML loads into the Blockly workspace
4. Click ▶ Run to start trading`}]}],o=()=>{let[e,t]=(0,r.useState)(`intro`),n=a.find(t=>t.id===e)||a[0];return(0,i.jsxs)(`div`,{className:`ahmed-learning`,children:[(0,i.jsxs)(`div`,{className:`ahmed-learning__sidebar`,children:[(0,i.jsxs)(`div`,{className:`ahmed-learning__sidebar-title`,children:[(0,i.jsx)(`span`,{children:`📚`}),` Learning Hub`]}),a.map(n=>(0,i.jsxs)(`button`,{className:`ahmed-learning__nav-item ${e===n.id?`active`:``}`,style:e===n.id?{borderColor:n.color,color:n.color}:{},onClick:()=>t(n.id),children:[(0,i.jsx)(`span`,{className:`ahmed-learning__nav-icon`,children:n.icon}),(0,i.jsx)(`span`,{children:n.title})]},n.id))]}),(0,i.jsxs)(`div`,{className:`ahmed-learning__content`,children:[(0,i.jsxs)(`div`,{className:`ahmed-learning__topic-header`,style:{borderColor:n.color},children:[(0,i.jsx)(`span`,{className:`ahmed-learning__topic-icon`,children:n.icon}),(0,i.jsx)(`div`,{children:(0,i.jsx)(`h2`,{style:{color:n.color},children:n.title})})]}),(0,i.jsx)(`div`,{className:`ahmed-learning__sections`,children:n.content.map((e,t)=>(0,i.jsxs)(`div`,{className:`ahmed-learning__section`,style:{borderColor:`${n.color}30`},children:[(0,i.jsx)(`h3`,{className:`ahmed-learning__section-heading`,style:{color:n.color},children:e.heading}),(0,i.jsx)(`div`,{className:`ahmed-learning__section-text`,children:e.text.split(`
`).map((e,t)=>(0,i.jsx)(`p`,{children:e},t))})]},t))}),(0,i.jsxs)(`div`,{className:`ahmed-learning__tip`,children:[(0,i.jsx)(`span`,{children:`💡`}),(0,i.jsxs)(`p`,{children:[`Use the `,(0,i.jsx)(`strong`,{children:`AI Scanner`}),` (floating panel on the left) to automatically detect the best market setup based on the PDF rules above. The scanner will suggest when to load the Ahmed SYN bot.`]})]})]})]})};export{o as default};