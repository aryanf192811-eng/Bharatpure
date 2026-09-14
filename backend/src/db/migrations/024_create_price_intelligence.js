exports.shorthands = undefined;

// Price recommendations per batch quality band + crop + destination. Per BHARATPURE-DB.md
// table 24. Quality bands: PREMIUM >=90, STANDARD 70-89, ECONOMY <70 (enforced in service layer).
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE price_intelligence (
      id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      crop_type                 VARCHAR(100) NOT NULL,
      quality_score_band        VARCHAR(20) NOT NULL CHECK (quality_score_band IN ('PREMIUM','STANDARD','ECONOMY')),
      destination_city          VARCHAR(100) NOT NULL,
      commodity_price_paise     BIGINT NOT NULL,
      recommended_low_paise     BIGINT NOT NULL,
      recommended_high_paise    BIGINT NOT NULL,
      premium_pct               DECIMAL(5, 2) NOT NULL,
      buyer_acceptance_prob     DECIMAL(5, 2),
      model_version             VARCHAR(50) NOT NULL,
      generated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_price_intel_lookup ON price_intelligence(crop_type, quality_score_band, destination_city, generated_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS price_intelligence CASCADE;`);
};
