exports.shorthands = undefined;

// In-app notification system, all roles. Per BHARATPURE-DB.md table 29.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE notifications (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID NOT NULL REFERENCES users(id),
      type            VARCHAR(50) NOT NULL,
      title           VARCHAR(255) NOT NULL,
      body            TEXT NOT NULL,
      metadata        JSONB DEFAULT '{}',
      read_at         TIMESTAMPTZ DEFAULT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS notifications CASCADE;`);
};
