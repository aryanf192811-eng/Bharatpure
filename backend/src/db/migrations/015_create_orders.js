exports.shorthands = undefined;

// Buyer orders — one order can span multiple listings/batches. Per BHARATPURE-DB.md table 15.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE orders (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_id              UUID NOT NULL REFERENCES users(id),
      buyer_role            VARCHAR(20) NOT NULL CHECK (buyer_role IN ('CONSUMER','BULK_BUYER')),
      total_amount_paise    BIGINT NOT NULL,
      status                VARCHAR(30) NOT NULL DEFAULT 'placed'
                              CHECK (status IN (
                                'placed',
                                'confirmed',
                                'allocation_pending',
                                'allocated',
                                'dispatched',
                                'delivered',
                                'cancelled',
                                'refunded',
                                'disputed'
                              )),
      delivery_address      JSONB NOT NULL,
      delivery_notes        TEXT,
      estimated_delivery_at TIMESTAMPTZ,
      actual_delivery_at    TIMESTAMPTZ,
      cancellation_reason   TEXT,
      refund_amount_paise   BIGINT DEFAULT 0,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_orders_buyer ON orders(buyer_id, created_at DESC);
    CREATE INDEX idx_orders_status ON orders(status);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS orders CASCADE;`);
};
