exports.shorthands = undefined;

// Extended profile for FARMER role users. Per BHARATPURE-DB.md table 5.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE farmer_profiles (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id               UUID NOT NULL UNIQUE REFERENCES users(id),
      cluster_id            UUID REFERENCES clusters(id),
      agristack_farmer_id   VARCHAR(50) UNIQUE,
      land_gps_lat          DECIMAL(10, 7),
      land_gps_lng          DECIMAL(10, 7),
      land_area_acres       DECIMAL(8, 2),
      primary_crop          VARCHAR(100),
      crop_history          JSONB DEFAULT '[]',
      quality_premium_earned_paise BIGINT NOT NULL DEFAULT 0,
      total_batches         INTEGER NOT NULL DEFAULT 0,
      fulfillment_rate      DECIMAL(5, 2),
      state                 VARCHAR(100),
      district              VARCHAR(100),
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS farmer_profiles CASCADE;`);
};
