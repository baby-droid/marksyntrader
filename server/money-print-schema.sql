CREATE TABLE IF NOT EXISTS money_print_presence (
    account_hash TEXT PRIMARY KEY,
    account_type TEXT NOT NULL CHECK (account_type IN ('demo', 'real')),
    currency TEXT NOT NULL,
    analytics_consent BOOLEAN NOT NULL DEFAULT FALSE,
    consented_at TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE money_print_presence
    ADD COLUMN IF NOT EXISTS analytics_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE money_print_presence
    ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS money_print_presence_last_seen_idx
    ON money_print_presence (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS money_print_trades (
    account_hash TEXT NOT NULL REFERENCES money_print_presence (account_hash) ON DELETE CASCADE,
    contract_id BIGINT NOT NULL,
    currency TEXT NOT NULL,
    market TEXT NOT NULL,
    contract_type TEXT NOT NULL,
    strategy_mode TEXT,
    barrier TEXT,
    duration INTEGER,
    duration_unit TEXT,
    stake NUMERIC(20, 8) NOT NULL,
    profit NUMERIC(20, 8) NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('WIN', 'LOSS', 'BREAKEVEN')),
    purchased_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (account_hash, contract_id)
);

CREATE INDEX IF NOT EXISTS money_print_trades_settled_idx
    ON money_print_trades (settled_at DESC);

CREATE TABLE IF NOT EXISTS money_print_admin_attempts (
    ip_hash TEXT PRIMARY KEY,
    failure_count INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ
);
