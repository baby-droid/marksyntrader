import path from 'path';
import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';

// Load .env.production into process.env before `source.define` reads it below.
// Heroku's build doesn't surface it otherwise; a missing file is a no-op.
loadEnv({ mode: 'production' });

const isStaticBuild = process.env.NEXT_PUBLIC_APP_BUILD === 'true';

// Resolve smartcharts from wherever the package actually lives so the asset
// copy works both standalone and inside the monorepo (npm workspaces hoist the
// package to the repo root, so a cwd-relative './node_modules/...' glob fails).
const smartchartsDist = path.join(
  path.dirname(require.resolve('@deriv-com/smartcharts-champion/package.json')),
  'dist'
);

export default defineConfig({
  plugins: [
    pluginSass({
      sassLoaderOptions: { sourceMap: true },
      exclude: /node_modules/,
    }),
    pluginReact(),
  ],
  source: {
    entry: { index: './src/main.tsx' },
    define: {
      'process.env': {
        // Deriv app id — drives OAuth login/sign-up and WebSocket connections. The
        // preview pipeline sets this from BOT_APP_ID (see scripts/build-previews.js);
        // sibling templates use the same name.
        NEXT_PUBLIC_DERIV_APP_ID: JSON.stringify(process.env.NEXT_PUBLIC_DERIV_APP_ID ?? ''),
        // Authoritative environment signal. The bot's URL resolver (config.ts) and
        // the vendored deriv-core OAuth resolver both read this so endpoints stay consistent
        // on a deployed partner domain (where hostname detection can't match Deriv).
        NEXT_PUBLIC_DERIV_ENV: JSON.stringify(process.env.NEXT_PUBLIC_DERIV_ENV ?? ''),
        // Partner referral link for affiliate attribution on OAuth login/sign-up.
        NEXT_PUBLIC_DERIV_REFERRAL_LINK: JSON.stringify(process.env.NEXT_PUBLIC_DERIV_REFERRAL_LINK ?? ''),
        // Partner app name. The BFF writes this into .env.production at deploy time; the header
        // logo+name mark and the document title read it (with brand.config / default fallback).
        NEXT_PUBLIC_DERIV_APP_NAME: JSON.stringify(process.env.NEXT_PUBLIC_DERIV_APP_NAME ?? ''),
        // Marks the static preview build (served under /bot/preview); drives the
        // router basename so React Router resolves under that path prefix.
        NEXT_PUBLIC_APP_BUILD: JSON.stringify(process.env.NEXT_PUBLIC_APP_BUILD ?? ''),
        GD_CLIENT_ID: JSON.stringify(process.env.GD_CLIENT_ID),
        GD_APP_ID: JSON.stringify(process.env.GD_APP_ID),
        GD_API_KEY: JSON.stringify(process.env.GD_API_KEY),
      },
    },
    alias: {
      // Resolve from wherever the package actually lives so the build works
      // both standalone and inside the monorepo (npm workspaces hoist react to
      // the repo root, so a cwd-relative './node_modules/react' fails in CI).
      react: path.dirname(require.resolve('react/package.json')),
      'react-dom': path.dirname(require.resolve('react-dom/package.json')),
      '@/external': path.resolve(__dirname, './src/external'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/constants': path.resolve(__dirname, './src/constants'),
      '@/stores': path.resolve(__dirname, './src/stores'),
    },
  },
  output: {
    assetPrefix: isStaticBuild ? '/bot/preview/' : '/',
    distPath: {
      root: isStaticBuild ? 'out/preview' : 'dist',
    },
    copy: [
      {
        from: path.join(smartchartsDist, '*'),
        to: 'js/smartcharts/[name][ext]',
        globOptions: { ignore: ['**/*.LICENSE.txt'] },
      },
      // The flutter/canvaskit chart renderer lives in dist/chart/ and must keep its
      // directory structure so SmartCharts can load /js/smartcharts/chart/canvaskit/...
      { from: path.join(smartchartsDist, 'chart'), to: 'js/smartcharts/chart' },
      // Flutter resolves its asset bundle (AssetManifest.json, FontManifest.json, fonts,
      // packages) against the SmartCharts public path — /js/smartcharts/assets/ — even
      // though the engine files load from chart/. Mirror dist/assets/ there, preserving
      // structure. Without this the dev server's SPA fallback returns index.html and
      // flutter aborts booting on a JSON parse error, leaving the chart stuck on
      // "Retrieving Chart Data…".
      { from: path.join(smartchartsDist, 'assets'), to: 'js/smartcharts/assets' },
      { from: path.join(smartchartsDist, 'assets/*'), to: 'assets/[name][ext]' },
      { from: path.join(smartchartsDist, 'assets/fonts/*'), to: 'assets/fonts/[name][ext]' },
      { from: path.join(smartchartsDist, 'assets/shaders/*'), to: 'assets/shaders/[name][ext]' },
      { from: path.join(__dirname, 'public') },
    ],
  },
  html: { template: './index.html' },
  server: {
    compress: true,
  },
  dev: { hmr: true },
  tools: {
    rspack: {
      module: {
        rules: [
          {
            test: /\.xml$/,
            exclude: /node_modules/,
            use: 'raw-loader',
          },
        ],
      },
    },
  },
});
