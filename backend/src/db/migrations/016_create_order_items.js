exports.shorthands = undefined;

// Line items in an order — tracks which batch fills which quantity. Per BHARATPURE-DB.md
// table 16. subtotal_paise is always computed in SQL as ROUND(quantity_kg * price_per_kg_paise)
// at insert time by the service layer — never in JS, to avoid floating-point drift.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE order_items (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id              UUID NOT NULL REFERENCES orders(id),
      listing_id            UUID NOT NULL REFERENCES listings(id),
      batch_id              UUID NOT NULL REFERENCES batches(id),
      quantity_kg           DECIMAL(10, 2) NOT NULL,
      price_per_kg_paise    BIGINT NOT NULL,
      subtotal_paise        BIGINT NOT NULL,
      allocated_at          TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_order_items_order ON order_items(order_id);
    CREATE INDEX idx_order_items_batch ON order_items(batch_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS order_items CASCADE;`);
};
