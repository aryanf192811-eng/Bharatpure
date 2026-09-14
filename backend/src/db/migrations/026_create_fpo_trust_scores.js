exports.shorthands = undefined;

// Computed FPO trust scores, refreshed nightly. Per BHARATPURE-DB.md table 26.
// Formula (documented in docs/research/trust-score-formula.md when that cron job is built):
// computed_score = fulfillment_rate*0.30 + quality_consistency*0.25 + on_time_delivery_rate*0.20
//                  + (100-dispute_rate)*0.15 + buyer_rating_avg*20*0.10
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE fpo_trust_scores (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fpo_id                UUID NOT NULL REFERENCES fpo_profiles(id),
      fulfillment_rate      DECIMAL(5, 2),
      quality_consistency   DECIMAL(5, 2),
      on_time_delivery_rate DECIMAL(5, 2),
      dispute_rate          DECIMAL(5, 2),
      buyer_rating_avg      DECIMAL(3, 2),
      total_batches         INTEGER,
      computed_score        DECIMAL(5, 2),
      computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_trust_fpo ON fpo_trust_scores(fpo_id, computed_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS fpo_trust_scores CASCADE;`);
};
