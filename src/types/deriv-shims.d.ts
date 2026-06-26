// Ambient shims for templates/bot (owned in this repo — no upstream auto-sync).
//
// 1. `@deriv/stores/types` is a legacy deriv-app package that was never
//    published to npm. The bot's stores reference its types (TStores etc.).
//    Declared as `any` so the vendored store code type-checks without the
//    original deriv-app monorepo present.
declare module '@deriv/stores/types' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type TStores = any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type TPortfolioPosition = any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type TNotificationMessage = any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _default: any;
  export default _default;
}

// 2. `.xml` strategy files are imported as raw strings (rsbuild raw-loader).
declare module '*.xml' {
  const content: string;
  export default content;
}
