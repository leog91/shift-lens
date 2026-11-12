CREATE TABLE IF NOT EXISTS auth_user (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_session (
  id TEXT PRIMARY KEY NOT NULL, expires_at INTEGER NOT NULL, token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS auth_session_user_idx ON auth_session(user_id);
CREATE TABLE IF NOT EXISTS auth_account (
  id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL, provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  access_token TEXT, refresh_token TEXT, id_token TEXT, access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER, scope TEXT, password TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_account_user_idx ON auth_account(user_id);
CREATE TABLE IF NOT EXISTS auth_verification (
  id TEXT PRIMARY KEY NOT NULL, identifier TEXT NOT NULL, value TEXT NOT NULL,
  expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_verification_identifier_idx ON auth_verification(identifier);
CREATE TABLE IF NOT EXISTS auth_rate_limit (
  id TEXT PRIMARY KEY NOT NULL, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, last_request INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS published_snapshots (
  company_id TEXT PRIMARY KEY NOT NULL, source_id TEXT NOT NULL,
  revision INTEGER NOT NULL, payload_json TEXT NOT NULL, received_at TEXT NOT NULL
);
