exports.shorthands = undefined;

// Test results for each batch — a batch can have multiple tests (rapid + NABL).
// Per BHARATPURE-DB.md table 11.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE quality_tests (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id        UUID NOT NULL REFERENCES batches(id),
      tier            VARCHAR(10) NOT NULL CHECK (tier IN ('TIER1','TIER2')),
      result          VARCHAR(10) NOT NULL CHECK (result IN ('PASS','FAIL','PENDING')),
      purity_score    DECIMAL(5, 2),
      test_parameters JSONB DEFAULT '{}',
      lab_name        VARCHAR(255),
      lab_accreditation VARCHAR(50),
      tested_at       TIMESTAMPTZ,
      tested_by       UUID REFERENCES users(id),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_quality_batch ON quality_tests(batch_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS quality_tests CASCADE;`);
};
