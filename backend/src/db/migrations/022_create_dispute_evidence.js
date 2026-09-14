exports.shorthands = undefined;

// Evidence attached to a dispute (BIR events, photos, documents). Per BHARATPURE-DB.md table 22.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE dispute_evidence (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dispute_id      UUID NOT NULL REFERENCES disputes(id),
      evidence_type   VARCHAR(30) NOT NULL CHECK (evidence_type IN ('BIR_EVENT','PHOTO','DOCUMENT','BIR_SNAPSHOT')),
      bir_event_id    UUID REFERENCES bir_events(id),
      file_url        TEXT,
      description     TEXT,
      submitted_by    UUID REFERENCES users(id),
      submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS dispute_evidence CASCADE;`);
};
