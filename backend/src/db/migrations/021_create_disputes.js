exports.shorthands = undefined;

// Order disputes raised by buyers. Per BHARATPURE-DB.md table 21. Dispute window (48h from
// actual_delivery_at) is enforced in the service layer, not here.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE disputes (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id          UUID NOT NULL REFERENCES orders(id),
      raised_by         UUID NOT NULL REFERENCES users(id),
      reason_category   VARCHAR(50) NOT NULL CHECK (reason_category IN (
        'QUALITY_MISMATCH',
        'QUANTITY_SHORT',
        'TEMPERATURE_BREACH',
        'WRONG_PRODUCT',
        'NOT_DELIVERED',
        'OTHER'
      )),
      description       TEXT NOT NULL,
      status            VARCHAR(20) NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','under_review','resolved','dismissed')),
      resolution        TEXT,
      resolved_by       UUID REFERENCES users(id),
      resolved_at       TIMESTAMPTZ,
      refund_amount_paise BIGINT DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_disputes_order ON disputes(order_id);
    CREATE INDEX idx_disputes_status ON disputes(status);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS disputes CASCADE;`);
};
