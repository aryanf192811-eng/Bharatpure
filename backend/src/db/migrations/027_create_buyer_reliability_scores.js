exports.shorthands = undefined;

// Computed reliability scores for bulk buyers. Per BHARATPURE-DB.md table 27.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE buyer_reliability_scores (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_id              UUID NOT NULL REFERENCES users(id),
      payment_reliability   DECIMAL(5, 2),
      order_accuracy        DECIMAL(5, 2),
      cancellation_rate     DECIMAL(5, 2),
      dispute_rate          DECIMAL(5, 2),
      computed_score        DECIMAL(5, 2),
      computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS buyer_reliability_scores CASCADE;`);
};
