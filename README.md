# Deriv Trading Bot

A self-hosted, visual trading-bot builder on the Deriv WebSocket API. Drag-and-drop
strategy building with Blockly, an interactive SmartCharts chart, automated strategy
execution, and dashboard/tutorials.

> **Note:** Unlike the other templates in this repo (Rise/Fall, Accumulators, Digits)
> which are **Next.js** apps, the bot is a **[Rsbuild](https://rsbuild.dev) + React
> Router** single-page app. The commands, build output, and environment variables
> below differ accordingly.

## Prerequisites

- Node.js 18.18 or later

## Step 1: Register Your App ID

1. Log in to your Deriv account and go to the [API Token page](https://app.deriv.com/account/api-token) to create a token with the required scopes.
2. Navigate to [App Registration](https://developers.deriv.com/dashboard/) and register a new application.
3. Set the **Redirect URI** to the URL where you will host this app (e.g. `http://localhost:4003` for local development).
4. Copy the **App ID** shown after registration — you will need it in the next step.

## Step 2: Configure `.env`

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
# Required: Deriv app id — drives OAuth login/sign-up and WebSocket connections.
NEXT_PUBLIC_DERIV_APP_ID=your_app_id_here

# Optional: environment + affiliate attribution.
NEXT_PUBLIC_DERIV_ENV=production
NEXT_PUBLIC_DERIV_REFERRAL_LINK=your_referral_link_here

# Optional: Google Drive integration (leave blank to disable).
GD_CLIENT_ID=
GD_APP_ID=
GD_API_KEY=
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_DERIV_APP_ID` | Deriv app id issued for your registered app. Drives OAuth login/sign-up and WebSocket connections. Without it, Log in / Sign up stay disabled. |
| `NEXT_PUBLIC_DERIV_ENV` | `production` for live Deriv endpoints; `preview` (or `staging`) for staging. Read by both the bot's URL resolver and `@deriv/core` for OAuth. |
| `NEXT_PUBLIC_DERIV_REFERRAL_LINK` | Affiliate referral link — appended as `affiliate_token` / `utm_campaign` on OAuth (optional). |
| `GD_CLIENT_ID` / `GD_APP_ID` / `GD_API_KEY` | Google Drive integration credentials for saving/loading strategies (optional). |

> These variables are injected at **build time** via Rsbuild's `source.define`
> (see `rsbuild.config.ts`), so re-build after changing them.

## Step 3: Local Development

```bash
npm install
npm run dev
```

The app is available at `http://localhost:4003`. (`npm install` and `npm run dev`
also regenerate brand CSS — see Branding below.)

## Step 4: Build for Production

```bash
npm run build
```

This produces a static build in the `dist/` directory (Rsbuild output — there is no
`.next`/`out`). Serve the contents of `dist/` from any web server or static host.
SmartCharts engine assets are copied into `dist/js/smartcharts/` during the build.

## Google Drive integration (optional)

Saving/loading strategies to Google Drive stays disabled unless `GD_CLIENT_ID`,
`GD_APP_ID`, and `GD_API_KEY` are all set. **If it's not set up in your host
environment yet:**

1. **Get the credentials** — follow Google's [Picker set-up guide](https://developers.google.com/workspace/drive/picker/guides/web-picker#set-up-environment):
   enable the **Google Picker API** + **Drive API**, then create an **OAuth 2.0
   Client ID** (Web application) and an **API key**. Use the project number as `GD_APP_ID`.
2. **Authorize your domain** — add your deployed URL (e.g. `https://your-app.vercel.app`)
   to the OAuth client's **Authorized JavaScript origins** (exact origin; no wildcards).
3. **Set them in your host env — not in source** — add the three vars to your host
   (Vercel → Settings → Environment Variables; Heroku → Settings → Config Vars).
   Don't commit them to the repo.
4. **Rebuild** — they're baked in at build time (`source.define`), so trigger a new build/deploy.

> Deploying via Deriv App Builder? Open your app in **Edit** mode and enter these
> three values — App Builder injects them into your host environment for you
> (never into the app source).

## Branding & White-labeling

Branding (logo, primary color, fonts, app name) is driven by **`brand.config.json`**,
not Next.js config:

- **Colors / fonts / app name** — edit `brand.config.json`, then run
  `npm run generate:brand-css` to bake the values into the theme CSS variables. This
  runs automatically on `npm install`, `npm run dev`, and `npm run build`.
- **Logo** — drop a `public/logo.<png|jpg|jpeg|webp>` to set the header logo; it is also
  used as the favicon. Without it, a letter badge (the app name's first letter) is shown.
- **Theme** — a light/dark toggle lives in the header; the chart re-themes with it.

When assembled by the App Builder, these are configured for you (logo upload, color,
font, and app name are injected at deploy time).
