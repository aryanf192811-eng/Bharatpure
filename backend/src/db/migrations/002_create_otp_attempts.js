exports.shorthands = undefined;

// Tracks OTP submission attempts per user to enforce lockout. Per BHARATPURE-DB.md table 2.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE otp_attempts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id),
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      succeeded   BOOLEAN NOT NULL DEFAULT FALSE,
      ip_address  VARCHAR(45)
    );

    CREATE INDEX idx_otp_attempts_user_recent ON otp_attempts(user_id, attempted_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS otp_attempts CASCADE;`);
};
