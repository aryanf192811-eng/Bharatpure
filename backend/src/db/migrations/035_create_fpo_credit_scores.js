exports.shorthands = undefined;

// Lending-eligibility signal for FPOs, computed alongside fpo_trust_scores by the same nightly
// job (trust-score.job.js). Same "latest + history" shape as fpo_trust_scores/
// buyer_reliability_scores.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE fpo_credit_scores (
      id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fpo_id                      UUID NOT NULL REFERENCES fpo_profiles(id),
      trust_score_component       DECIMAL(5, 2) NOT NULL,
      repayment_proxy_component   DECIMAL(5, 2) NOT NULL,
      batch_volume_component      DECIMAL(5, 2) NOT NULL,
      dispute_penalty_component   DECIMAL(5, 2) NOT NULL,
      computed_score               DECIMAL(5, 2) NOT NULL,
      eligibility_band            VARCHAR(20) NOT NULL CHECK (eligibility_band IN ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA')),
      computed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_fpo_credit_scores_fpo ON fpo_credit_scores(fpo_id, computed_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS fpo_credit_scores CASCADE;`);
};
