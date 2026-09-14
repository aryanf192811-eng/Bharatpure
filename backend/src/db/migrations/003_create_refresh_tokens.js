exports.shorthands = undefined;

// Tracks issued refresh tokens for rotation. Per BHARATPURE-DB.md table 3.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE refresh_tokens (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id),
      token_hash  VARCHAR(255) NOT NULL UNIQUE,
      issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL,
      revoked_at  TIMESTAMPTZ DEFAULT NULL,
      ip_address  VARCHAR(45),
      user_agent  TEXT
    );

    CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS refresh_tokens CASCADE;`);
};
