exports.shorthands = undefined;

// Extended profile for FPO-operating FARMER users. Per BHARATPURE-DB.md table 6.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE fpo_profiles (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id               UUID NOT NULL UNIQUE REFERENCES users(id),
      fpo_name              VARCHAR(255) NOT NULL,
      registration_number   VARCHAR(100) UNIQUE NOT NULL,
      state                 VARCHAR(100) NOT NULL,
      district              VARCHAR(100) NOT NULL,
      primary_crop_types    TEXT[] NOT NULL DEFAULT '{}',
      member_count          INTEGER NOT NULL DEFAULT 0,
      trust_score           DECIMAL(5, 2) DEFAULT NULL,
      ondc_seller_id        VARCHAR(100) UNIQUE,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS fpo_profiles CASCADE;`);
};
