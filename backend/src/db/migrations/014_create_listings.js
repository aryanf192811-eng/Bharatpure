exports.shorthands = undefined;

// Marketplace listings — created from a batch by an FPO/farmer setting a price.
// Per BHARATPURE-DB.md table 14.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE listings (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id              UUID NOT NULL REFERENCES batches(id),
      listed_by             UUID NOT NULL REFERENCES users(id),
      price_per_kg_paise    BIGINT NOT NULL,
      min_order_kg          DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
      max_order_kg          DECIMAL(10, 2),
      listing_type          VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                              CHECK (listing_type IN ('OPEN','BULK_ONLY','CONSUMER_ONLY')),
      available_from        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      available_until       TIMESTAMPTZ,
      status                VARCHAR(20) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','paused','sold_out','expired','cancelled')),
      ondc_listed           BOOLEAN NOT NULL DEFAULT FALSE,
      views_count           INTEGER NOT NULL DEFAULT 0,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at            TIMESTAMPTZ DEFAULT NULL
    );

    CREATE INDEX idx_listings_batch ON listings(batch_id) WHERE deleted_at IS NULL;
    CREATE INDEX idx_listings_status ON listings(status) WHERE deleted_at IS NULL;
    CREATE INDEX idx_listings_type ON listings(listing_type, status) WHERE deleted_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS listings CASCADE;`);
};
