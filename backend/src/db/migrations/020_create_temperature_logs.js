exports.shorthands = undefined;

// IoT cold-chain temperature readings, appended continuously during cold delivery.
// Per BHARATPURE-DB.md table 20.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE temperature_logs (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id          UUID NOT NULL REFERENCES batches(id),
      route_id          UUID REFERENCES delivery_routes(id),
      temperature_c     DECIMAL(5, 2) NOT NULL,
      threshold_c       DECIMAL(5, 2) NOT NULL,
      breach_detected   BOOLEAN NOT NULL DEFAULT FALSE,
      vehicle_id        VARCHAR(50),
      location_lat      DECIMAL(10, 7),
      location_lng      DECIMAL(10, 7),
      logged_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_temp_logs_batch ON temperature_logs(batch_id, logged_at ASC);
    CREATE INDEX idx_temp_logs_breach ON temperature_logs(batch_id) WHERE breach_detected = TRUE;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS temperature_logs CASCADE;`);
};
