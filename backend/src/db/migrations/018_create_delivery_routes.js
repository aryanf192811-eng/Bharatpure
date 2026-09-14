exports.shorthands = undefined;

// OR-Tools output — one route plan per delivery batch. Per BHARATPURE-DB.md table 18.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE delivery_routes (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_name            VARCHAR(255),
      total_distance_km     DECIMAL(10, 2),
      estimated_duration_h  DECIMAL(6, 2),
      vehicle_type          VARCHAR(30) CHECK (vehicle_type IN ('DRY_VAN','COLD_VAN','MOTORCYCLE')),
      vehicle_id            VARCHAR(50),
      driver_id             UUID REFERENCES users(id),
      optimized_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status                VARCHAR(20) NOT NULL DEFAULT 'planned'
                              CHECK (status IN ('planned','in_progress','completed','cancelled')),
      baseline_distance_km  DECIMAL(10, 2),
      cost_estimate_paise   BIGINT,
      baseline_cost_paise   BIGINT,
      started_at            TIMESTAMPTZ,
      completed_at          TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS delivery_routes CASCADE;`);
};
