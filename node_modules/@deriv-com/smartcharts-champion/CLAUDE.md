# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SmartCharts is a React-based charting library published as `@deriv-com/smartcharts-champion` on npm. It provides interactive financial charts with real-time data streaming, technical indicators, drawing tools, and customizable UI components. The library uses TypeScript, MobX for state management, and integrates with a Flutter-based chart rendering engine.

## Common Development Commands

### Development

-   `npm start` - Start webpack dev server for the sample app (runs on http://localhost:8080)
-   `npm run watch '../path/to/node_modules/@deriv-com/smartcharts-champion/dist'` - Watch mode that builds directly into another project's node_modules (useful for testing library changes)

### Building

-   `npm run build` - Build the library for production (outputs to `dist/`)
-   `npm run build:app` - Build the sample app (outputs to `dist/`)
-   Note: Both commands output `smartcharts.js` and `smartcharts.css`, but they are different files (library vs app)

### Testing

-   `npm test` - Run unit tests with Mocha
-   `npm run coverage` - Generate test coverage report
-   Test files are located in `__tests__` directories with `.spec.ts` extension
-   Uses Mocha + Chai + Sinon for testing

### Code Quality

-   `npm run prettify` - Format code with Prettier
-   ESLint runs automatically during webpack builds
-   StyleLint runs automatically during webpack builds
-   Husky pre-commit hooks run lint-staged

### Analysis

-   `npm run analyze` - Run webpack-bundle-analyzer to visualize bundle size

### Translations

-   `npm run translations` - Extract translation strings from the built library
-   `npm run translations:download` - Download translations from Crowdin

## Architecture Overview

### Directory Structure

```
src/
├── components/          # React UI components (templates)
├── store/              # MobX stores (state management)
├── feed/               # Data feed and subscription management
├── binaryapi/          # Binary API integration (TradingTimes, etc.)
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── hooks/              # React custom hooks
├── constants/          # Constants and configuration
├── flutter-chart/      # Flutter chart integration layer
└── index.ts            # Library entry point
```

### State Management Pattern (Mobdux)

SmartCharts uses a variation of Mobdux pattern combining MobX and Redux-like architecture. Each component consists of:

1. **Template** (`.tsx` file) - React component
2. **Store** (`*Store.ts` file) - MobX state management

There are three types of components:

#### 1. Main Components

-   Tied directly to the main store tree
-   Only one instance per `<SmartChart />` component
-   Examples: `ChartTitle`, `TimePeriod`, `Views`
-   Connection done in the `.tsx` file using `connect(mapperFunction)`
-   Should be Stateless Functional Components (SFC)

#### 2. Subcomponents

-   Multiple instances can exist in the same state tree
-   Connected inside parent store's constructor
-   Examples: `Menu`, `List`, `CategoricalDisplay`
-   Store has its own `connect` method
-   Passed as props from parent component

#### 3. Independent Components

-   Not managed by main store lifecycle
-   Manage their own lifecycle (constructor, updateProps, destructor)
-   Can access main store but main store doesn't control them
-   Examples: `Barrier`, `ChartMode`, `FastMarker`
-   Connection requires both mapperFunction and store class: `connect(mapperFunction, StoreClass)`

### Key Stores

-   `MainStore` - Root store that orchestrates all other stores
-   `ChartStore` - Core chart state and operations
-   `ChartState` - Chart configuration, settings, and layout management
-   `ChartAdapterStore` - Flutter chart integration layer
-   `Feed` - Data subscription and quote management
-   `BarrierStore` - Chart barriers (price lines, shading)
-   `DrawToolsStore` - Drawing tools and annotations
-   `CrosshairStore` - Crosshair visibility and interaction state

### Data Flow

1. **Historical Data**: Host app provides `getQuotes` function
2. **Real-time Data**: Host app provides `subscribeQuotes` and `unsubscribeQuotes`
3. **Market Data**: Optionally passed via `chartData` prop (activeSymbols, tradingTimes)
4. **Chart Rendering**: TypeScript → Flutter chart layer → Canvas rendering

SmartCharts does NOT fetch data directly - it delegates to the host application.

## TypeScript Configuration

-   Target: ES5
-   Module: ES2020
-   JSX: react-jsx
-   Strict mode enabled
-   Path alias: `@deriv-com/smartcharts` maps to `src/`
-   Includes all `.ts` and `.tsx` files
-   Excludes all `.js` and `.jsx` files

## Webpack Build Modes

The build system has two modes controlled by `BUILD_MODE` environment variable:

-   `BUILD_MODE=app` - Builds the sample app (entry: `app/index.tsx`)
-   Default (no BUILD_MODE) - Builds the library (entry: `src/index.ts`)

Library build outputs:

-   UMD module format
-   Library name: `smartcharts`
-   Chunks: `[name]-[chunkhash:6].smartcharts.js`
-   Assets must be copied to host application

## Working with SVGs

1. **CSS Background SVGs** - Inlined via postcss-inline-svg (used for loader)
2. **External SVGs** - Bundled into sprite sheet via svg-sprite-loader
    - Can control stroke and fill color via CSS
    - Remove stroke/fill attributes from SVG files to enable CSS control
    - Cached by browser using shadow DOM

## Key Integration Points

### Flutter Chart

-   Chart rendering is handled by Flutter web application in `chart_app/`
-   Flutter build output is in `chart_app/build/web`
-   TypeScript interfaces bridge to Flutter via `chartAdapter.flutterChart`
-   Methods like `updateCrosshairVisibility()` update Flutter chart state

### Library Usage by Host Apps

-   Host must copy chunks (`*.smartcharts.*`) and CSS from `dist/`
-   Host must call `setSmartChartsPublicPath()` to configure chunk loading
-   Host must copy `dist/chart/assets` folder
-   Example using CopyWebpackPlugin is in README

## Component Development Guidelines

### Temporary Crosshair Disable Pattern

When UI interactions should temporarily hide the crosshair:

```typescript
onMouseEnter = () => this.crosshairStore.setTemporaryDisabled(true);
onMouseLeave = () => this.crosshairStore.setTemporaryDisabled(false);
```

### Icon and Label UX Pattern

-   Icon represents **current state**
-   Label describes **available action**
-   Tooltips disabled on mobile

### MobX Best Practices

-   Use `makeObservable` in store constructors
-   Wrap components with `observer` for reactivity
-   Use computed properties for derived state
-   Always use `isFunctionallyActive` for crosshair state (not `isEnabled` directly)

## Testing

-   Test framework: Mocha with Chai assertions
-   Test runner uses ts-node with CommonJS module compilation
-   Test pattern: `src|app/**/__tests__/*.spec.ts`
-   Use Sinon for mocking and spies
-   Coverage reporting via nyc (Istanbul)

## Release Management

-   Uses semantic-release for automated versioning
-   Configuration in `release.config.cjs`
-   Changelog generation via @semantic-release/changelog
-   NPM publishing via @semantic-release/npm
-   GitHub releases via @semantic-release/github

To publish manually:

```bash
npm run build && npm publish
```

## Git Workflow

-   Main branch: `master`
-   Husky pre-commit hooks enforce lint-staged rules
-   Conventional commits enforced via commitlint
-   Use `npm run commit` for guided commit messages

## Translation System

-   All user-facing strings must be wrapped in `t.translate()`
-   Translation keys support interpolation: `t.translate('[currency] [amount] payout', { currency: 'USD', amount: 43.12 })`
-   Change language: `t.setLanguage('fr', callback)`
-   Translations managed via Crowdin

## Important Notes

-   **Node version**: >=18.0.0
-   **NPM version**: >=9.0.0
-   Library exports are in `src/index.ts` - this defines the public API
-   The `id` prop enables persistence of indicators, symbol, and layout to localStorage
-   Chart state persistence uses key pattern: `layout-{id}`
-   Component-specific documentation available in `docs/` directory

## Reference Documentation

-   [Crosshair Maintainer's Guide](docs/CROSSHAIR_MAINTAINERS_GUIDE.md) - Comprehensive guide for crosshair functionality
-   [SmartChart Guide](docs/SmartChart-Guide.md) - Usage guide
-   [README.md](README.md) - Complete API documentation and usage examples
