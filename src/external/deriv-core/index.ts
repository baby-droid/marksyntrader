// Vendored subset of @deriv/core.
//
// The bot is an owned, standalone rsbuild app and must build without the
// monorepo's `packages/core` workspace (the BFF copies only `templates/bot/**`
// into the partner's standalone app). `@deriv/core` has zero runtime deps and
// the bot only needs its auth/config layer, so that subset is vendored here.
// React hooks and the WebSocket client are intentionally NOT vendored — the bot
// has its own DerivWSAccountsService. To update, re-copy auth/, config/, and
// types/ from packages/core/src.

// Auth
export {
  buildAuthorizationUrl,
  buildSignUpUrl,
  initiateLogin,
  initiateSignUp,
  parseCallbackParams,
  validateCallback,
  exchangeCodeForTokens,
  refreshAccessToken,
  handleOAuthCallback,
  cleanupUrl,
  OAuthError,
  fetchAccounts,
  getWebSocketOTP,
  logout,
  generateRandomBase64url,
  sha256Base64url,
  base64urlEncode,
  storeCSRFToken,
  getCSRFToken,
  clearCSRFToken,
  storeCodeVerifier,
  getCodeVerifier,
  clearCodeVerifier,
  storeAuthInfo,
  getAuthInfo,
  clearAuthInfo,
  storeDerivAccounts,
  getDerivAccounts,
  clearDerivAccounts,
  setActiveLoginId,
  getActiveLoginId,
  setAccountType,
  getAccountType,
  clearAllAuthData,
  parseReferralLink,
  parseLandingParams,
  resolveReferralViaProxy,
} from './auth';

// Types
export type {
  AuthConfig,
  AuthInfo,
  DerivAccount,
  OTPResponse,
  TokenExchangeParams,
  CallbackParams,
  AuthState,
  StoredCSRFToken,
  StoredCodeVerifier,
  ActiveSymbol,
  Tick,
  TicksHistoryResponse,
  ContractsForResponse,
  ContractInfo,
  DurationLimits,
  ProposalResponse,
  ProposalInfo,
  BuyResponse,
  BuyResult,
  ProposalParams,
} from './types';

// Config
export { getAuthBaseUrl, getApiBaseUrl, getPublicWsUrl } from './config';
