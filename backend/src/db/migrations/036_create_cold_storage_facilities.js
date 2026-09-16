exports.shorthands = undefined;

// Fixed cold-storage facility locations, needed for the temperature-breach auto-reroute feature
// -- nothing in this schema represented a lookup-able "nearest facility" before this (the only
// prior "hub" concept was a lat/lng the admin supplies fresh on every routing call, never a
// persisted location). Also adds route_stops.batch_id: a route_stops row previously only linked
// to order_id (null for any non-delivery stop), so there was no way to trace a stop back to the
// batch that caused it -- needed to resolve a reroute stop back to the batch under review when
// the driver completes it.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE cold_storage_facilities (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name         VARCHAR(255) NOT NULL,
      state        VARCHAR(100) NOT NULL,
      district     VARCHAR(100) NOT NULL,
      latitude     DECIMAL(10, 7) NOT NULL,
      longitude    DECIMAL(10, 7) NOT NULL,
      capacity_kg  INTEGER NOT NULL,
      status       VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_cold_storage_status ON cold_storage_facilities(status);

    ALTER TABLE route_stops ADD COLUMN batch_id UUID REFERENCES batches(id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE route_stops DROP COLUMN IF EXISTS batch_id;
    DROP TABLE IF EXISTS cold_storage_facilities CASCADE;
  `);
};
