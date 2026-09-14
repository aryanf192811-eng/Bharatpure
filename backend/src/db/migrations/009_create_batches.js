exports.shorthands = undefined;

// Core entity — every batch of produce that enters the system. Per BHARATPURE-DB.md table 9.
// Critical: remaining_quantity_kg has no CHECK(>=0) here in the literal spec text, but EC-13
// requires it at the DB level (escrow/order atomic-decrement safety net) — added per that
// edge case, not invented.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE batches (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_code            VARCHAR(30) NOT NULL UNIQUE,
      cluster_id            UUID NOT NULL REFERENCES clusters(id),
      fpo_id                UUID REFERENCES fpo_profiles(id),
      farmer_id             UUID REFERENCES farmer_profiles(id),
      contract_id           UUID REFERENCES procurement_contracts(id),
      crop_type             VARCHAR(100) NOT NULL,
      harvest_date          DATE NOT NULL,
      total_quantity_kg     DECIMAL(10, 2) NOT NULL,
      remaining_quantity_kg DECIMAL(10, 2) NOT NULL CHECK (remaining_quantity_kg >= 0),
      quality_score         DECIMAL(5, 2),
      status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                              CHECK (status IN (
                                'draft',
                                'pending_test',
                                'test_passed',
                                'test_failed',
                                'listed',
                                'partially_sold',
                                'sold',
                                'dispatched',
                                'delivered',
                                'rejected_post_delivery'
                              )),
      rejection_reason      TEXT,
      qr_hash               VARCHAR(64) NOT NULL UNIQUE,
      qr_burned_at          TIMESTAMPTZ DEFAULT NULL,
      notes                 TEXT,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at            TIMESTAMPTZ DEFAULT NULL
    );

    CREATE INDEX idx_batches_status ON batches(status) WHERE deleted_at IS NULL;
    CREATE INDEX idx_batches_cluster ON batches(cluster_id);
    CREATE INDEX idx_batches_fpo ON batches(fpo_id);
    CREATE INDEX idx_batches_qr ON batches(qr_hash);
    CREATE INDEX idx_batches_crop ON batches(crop_type, status) WHERE deleted_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS batches CASCADE;`);
};
