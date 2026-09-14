exports.shorthands = undefined;

// Extended profile for CONSUMER role users. Not in the original BHARATPURE-DB.md 30-table
// schema — added because TASK-007 (registration) requires storing delivery_pincode per role,
// and no table existed to hold it. Same pattern as farmer_profiles/fpo_profiles: one row per
// user, 1:1 via UNIQUE FK.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE consumer_profiles (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           UUID NOT NULL UNIQUE REFERENCES users(id),
      delivery_pincode  VARCHAR(10) NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS consumer_profiles CASCADE;`);
};
