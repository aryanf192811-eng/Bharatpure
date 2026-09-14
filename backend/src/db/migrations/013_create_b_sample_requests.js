exports.shorthands = undefined;

// B-Sample referee protocol — when TIER1 fails, farmer can request independent NABL
// verification. Per BHARATPURE-DB.md table 13.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE b_sample_requests (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id            UUID NOT NULL REFERENCES batches(id),
      quality_test_id     UUID NOT NULL REFERENCES quality_tests(id),
      requested_by        UUID NOT NULL REFERENCES users(id),
      request_window_end  TIMESTAMPTZ NOT NULL,
      status              VARCHAR(30) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','lab_selected','dispatched','result_pass','result_fail','expired')),
      selected_lab        VARCHAR(255),
      result              VARCHAR(10) CHECK (result IN ('PASS','FAIL')),
      result_cert_url     TEXT,
      cost_paid_by        VARCHAR(20) CHECK (cost_paid_by IN ('FARMER','BHARATPURE')),
      notes               TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS b_sample_requests CASCADE;`);
};
