exports.shorthands = undefined;

// What-if simulator inputs/outputs, stored for audit trail. Per BHARATPURE-DB.md table 25.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE simulation_runs (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_by            UUID REFERENCES users(id),
      input_params      JSONB NOT NULL,
      output_results    JSONB NOT NULL,
      run_duration_ms   INTEGER,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS simulation_runs CASCADE;`);
};
