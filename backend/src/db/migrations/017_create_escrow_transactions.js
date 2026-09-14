exports.shorthands = undefined;

// Payment escrow — one escrow per order (order_id UNIQUE). Per BHARATPURE-DB.md table 17.
// See the atomic hold/release patterns documented alongside this table in BHARATPURE-DB.md —
// they belong in the order/escrow service layer, not here, but the schema is built to support
// them (order_id UNIQUE for exactly-one-escrow-per-order).
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE escrow_transactions (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id              UUID NOT NULL UNIQUE REFERENCES orders(id),
      amount_paise          BIGINT NOT NULL,
      status                VARCHAR(20) NOT NULL DEFAULT 'held'
                              CHECK (status IN ('held','released','refunded','partially_refunded')),
      payment_reference     VARCHAR(255),
      payment_method        VARCHAR(50) DEFAULT 'UPI',
      held_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      released_at           TIMESTAMPTZ,
      refunded_at           TIMESTAMPTZ,
      refund_amount_paise   BIGINT DEFAULT 0,
      release_triggered_by  VARCHAR(30)
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS escrow_transactions CASCADE;`);
};
