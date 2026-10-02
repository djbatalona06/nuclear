CREATE TABLE remote_devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash BLOB NOT NULL UNIQUE,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER,
    revoked_at INTEGER
);

CREATE INDEX idx_remote_devices_active ON remote_devices(token_hash) WHERE revoked_at IS NULL;
