/**
 * Centralized Deriv API trading token storage.
 * 
 * The trading token (a1-xxxx format from app.deriv.com/account/api-token) is
 * stored here and used by all custom trading components (AI assistant, Speed Lab,
 * Hedge Trade). It is separate from the OAuth bearer token used by the main DBot
 * WebSocket connection.
 */

const TOKEN_KEY = 'trading_token';

export function setTradingToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function getTradingToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) || null;
}

export function clearTradingToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

export function hasTradingToken(): boolean {
    const t = getTradingToken();
    return !!t && t.length > 5;
}
