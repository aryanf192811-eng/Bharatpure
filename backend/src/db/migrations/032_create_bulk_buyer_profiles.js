exports.shorthands = undefined;

// Extended profile for BULK_BUYER role users. Not in the original BHARATPURE-DB.md 30-table
// schema — added for the same reason as consumer_profiles (see 031). contact_person_name is
// NOT duplicated here — that's users.full_name. business_type values per
// BHARATPURE-CLAUDE.md's registration field spec.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE bulk_buyer_profiles (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id        UUID NOT NULL UNIQUE REFERENCES users(id),
      company_name   VARCHAR(255) NOT NULL,
      gstin          VARCHAR(15) NOT NULL UNIQUE,
      business_type  VARCHAR(30) NOT NULL
                       CHECK (business_type IN ('restaurant_chain','food_processor','institution','other')),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS bulk_buyer_profiles CASCADE;`);
};
