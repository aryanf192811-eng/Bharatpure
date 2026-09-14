exports.shorthands = undefined;

// Individual stops on a delivery route (ordered). Per BHARATPURE-DB.md table 19.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE route_stops (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id        UUID NOT NULL REFERENCES delivery_routes(id),
      order_id        UUID REFERENCES orders(id),
      stop_type       VARCHAR(20) NOT NULL CHECK (stop_type IN ('PICKUP','DELIVERY','HUB')),
      sequence_number INTEGER NOT NULL,
      location_name   VARCHAR(255),
      latitude        DECIMAL(10, 7) NOT NULL,
      longitude       DECIMAL(10, 7) NOT NULL,
      arrival_window_start TIMESTAMPTZ,
      arrival_window_end   TIMESTAMPTZ,
      actual_arrival_at    TIMESTAMPTZ,
      completed_at         TIMESTAMPTZ,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(route_id, sequence_number)
    );

    CREATE INDEX idx_route_stops_route ON route_stops(route_id, sequence_number ASC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS route_stops CASCADE;`);
};
