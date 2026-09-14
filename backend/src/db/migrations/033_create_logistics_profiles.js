exports.shorthands = undefined;

// Extended profile for LOGISTICS role users. Not in the original BHARATPURE-DB.md 30-table
// schema — added for the same reason as consumer_profiles (see 031). vehicle_type restricted
// to the two registration-time options from BHARATPURE-CLAUDE.md (dry van / cold van) — this
// is deliberately narrower than delivery_routes.vehicle_type, which also allows MOTORCYCLE for
// route planning; a driver's own registered vehicle is one of the two van types.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE logistics_profiles (
      id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                     UUID NOT NULL UNIQUE REFERENCES users(id),
      vehicle_type                VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('DRY_VAN','COLD_VAN')),
      vehicle_registration_number VARCHAR(20) NOT NULL UNIQUE,
      base_state                  VARCHAR(100),
      base_city                   VARCHAR(100),
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS logistics_profiles CASCADE;`);
};
