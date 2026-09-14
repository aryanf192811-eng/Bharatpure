exports.shorthands = undefined;

// Pre-sowing procurement agreements between BharatPure and FPOs ("forward market" layer).
// Per BHARATPURE-DB.md table 8.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE procurement_contracts (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fpo_id                UUID NOT NULL REFERENCES fpo_profiles(id),
      cluster_id            UUID NOT NULL REFERENCES clusters(id),
      crop_type             VARCHAR(100) NOT NULL,
      quantity_kg           DECIMAL(10, 2) NOT NULL,
      price_floor_paise     BIGINT NOT NULL,
      price_ceiling_paise   BIGINT NOT NULL,
      sowing_date           DATE NOT NULL,
      expected_harvest_date DATE NOT NULL,
      advance_amount_paise  BIGINT NOT NULL DEFAULT 0,
      advance_disbursed_at  TIMESTAMPTZ,
      advance_disbursed_via VARCHAR(50),
      status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','active','fulfilled','partially_fulfilled','cancelled','defaulted')),
      notes                 TEXT,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_contracts_fpo ON procurement_contracts(fpo_id);
    CREATE INDEX idx_contracts_status ON procurement_contracts(status);
    CREATE INDEX idx_contracts_harvest ON procurement_contracts(expected_harvest_date);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS procurement_contracts CASCADE;`);
};
