exports.shorthands = undefined;

// NABL certificate PDF metadata, linked to bir_events. Per BHARATPURE-DB.md table 12.
// Validation (MIME=application/pdf, size<=5MB, cert_number non-empty) enforced in controller,
// not here.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE quality_certificates (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id        UUID NOT NULL REFERENCES batches(id),
      quality_test_id UUID NOT NULL REFERENCES quality_tests(id),
      cert_number     VARCHAR(100) UNIQUE NOT NULL,
      cert_url        TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      mime_type       VARCHAR(50) NOT NULL DEFAULT 'application/pdf',
      issued_at       DATE NOT NULL,
      expires_at      DATE,
      uploaded_by     UUID REFERENCES users(id),
      uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS quality_certificates CASCADE;`);
};
