exports.shorthands = undefined;

// AI model output cache, refreshed every 6h via cron. Per BHARATPURE-DB.md table 23.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE demand_forecasts (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      crop_type         VARCHAR(100) NOT NULL,
      city              VARCHAR(100) NOT NULL,
      forecast_date     DATE NOT NULL,
      predicted_kg      DECIMAL(10, 2) NOT NULL,
      confidence_pct    DECIMAL(5, 2) NOT NULL,
      range_low_kg      DECIMAL(10, 2) NOT NULL,
      range_high_kg     DECIMAL(10, 2) NOT NULL,
      demand_drivers    JSONB NOT NULL DEFAULT '[]',
      model_version     VARCHAR(50) NOT NULL,
      generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(crop_type, city, forecast_date, model_version)
    );

    CREATE INDEX idx_demand_crop_city ON demand_forecasts(crop_type, city, forecast_date DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS demand_forecasts CASCADE;`);
};
