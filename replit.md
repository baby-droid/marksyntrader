# Ahmed Syn Trader — My Trading Bot

A professional automated trading platform built on the Deriv ecosystem. Users can build, test, and run trading bots using a visual Blockly-based interface, with pre-built strategies and real-time market data via Deriv's WebSocket API.

## Tech Stack
- **Frontend:** React 18 + TypeScript
- **Build Tool:** Rsbuild (Rspack-based)
- **State:** MobX
- **Bot Engine:** Blockly + @deriv/js-interpreter
- **Charts:** @deriv-com/smartcharts-champion
- **API:** @deriv/deriv-api (WebSocket)
- **Styling:** Sass + Quill UI

## Running the App
```bash
npm run dev
```
Starts the dev server on port 5000.

## Build
```bash
npm run build
```
Outputs to `dist/`.

## Auth
Uses Deriv's own OAuth2 + PKCE flow. No external auth providers. Tokens stored in localStorage. The `/callback` route handles the OAuth redirect.

## Environment Variables
Set in `.replit` under `[userenv.shared]`:
- `NEXT_PUBLIC_DERIV_APP_ID` — Deriv app ID
- `NEXT_PUBLIC_DERIV_REDIRECT_URI` — OAuth callback URL
- `NEXT_PUBLIC_DERIV_ENV` — `production` or `staging`
- `NEXT_PUBLIC_DERIV_APP_NAME` — Displayed app name

## User Preferences
- Keep existing project structure and file conventions
