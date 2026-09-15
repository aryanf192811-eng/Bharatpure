exports.shorthands = undefined;

// One row per cluster per crop-advisory.job.js run -- closes the loop from demand forecasting
// back to what farmers plant, per clusters.crop_type being singular (one crop per cluster).
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE crop_advisories (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cluster_id        UUID NOT NULL REFERENCES clusters(id),
      crop_type         VARCHAR(100) NOT NULL,
      demand_delta_pct  DECIMAL(6, 1) NOT NULL,
      recommendation    VARCHAR(20) NOT NULL CHECK (recommendation IN ('INCREASE', 'MAINTAIN', 'DECREASE')),
      rationale         TEXT NOT NULL,
      computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_crop_advisories_cluster ON crop_advisories(cluster_id, computed_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS crop_advisories CASCADE;`);
};
