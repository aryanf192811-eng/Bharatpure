exports.shorthands = undefined;

// Geographic farmer clusters, one crop type per cluster. Per BHARATPURE-DB.md table 4.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE clusters (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name            VARCHAR(255) NOT NULL,
      crop_type       VARCHAR(100) NOT NULL,
      state           VARCHAR(100) NOT NULL,
      district        VARCHAR(100) NOT NULL,
      latitude        DECIMAL(10, 7) NOT NULL,
      longitude       DECIMAL(10, 7) NOT NULL,
      active_farmers  INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_clusters_crop ON clusters(crop_type);
    CREATE INDEX idx_clusters_state ON clusters(state);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS clusters CASCADE;`);
};
