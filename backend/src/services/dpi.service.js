const fs = require('fs');

const { pool } = require('../db');

/**
 * Mock AgriStack farmer profile lookup. Real integration requires authorized state API access
 * and farmer consent (per BHARATPURE-CLAUDE.md's DPI glossary) -- this always returns a
 * synthetic profile, clearly labeled, never pretending to be live government data.
 */
const getAgristackFarmer = (farmerId) => ({
  data_source: 'AgriStack_mock_sandbox',
  farmer_id: farmerId,
  status: 'MOCK_VERIFIED',
  note: 'Sandbox response — production requires authorized state API access and farmer consent.',
  land_records: [{ survey_number: 'MOCK-SN-001', area_acres: 2.5, crop_registered: 'TURMERIC' }],
});

const getEnamPrices = (cropType, days = 30) => {
  const mock = JSON.parse(fs.readFileSync(process.env.ENAM_MOCK_DATA_PATH, 'utf-8'));
  const crop = mock.crops[cropType];
  if (!crop) {
    return { data_source: 'eNAM_mock_feed', crop_type: cropType, history: [] };
  }
  return { data_source: 'eNAM_mock_feed', crop_type: cropType, history: crop.history.slice(-days) };
};

/**
 * Formats active BharatPure listings as an ONDC Seller Network Participant catalog. Real ONDC
 * integration requires formal SNP onboarding (BHARATPURE-CLAUDE.md) -- this is a schema-shape
 * preview, not a live-published catalog.
 */
const getOndcListings = async () => {
  const result = await pool.query(
    `SELECT l.id, b.batch_code, b.crop_type, b.quality_score, l.price_per_kg_paise, l.min_order_kg, l.max_order_kg
     FROM listings l JOIN batches b ON b.id = l.batch_id
     WHERE l.status = 'active' AND l.deleted_at IS NULL AND b.deleted_at IS NULL
     ORDER BY l.created_at DESC LIMIT 50`,
  );
  return {
    data_source: 'ONDC_sandbox_adapter',
    note: 'Sandbox catalog preview — production requires ONDC participant onboarding.',
    items: result.rows.map((row) => ({
      id: row.id,
      descriptor: { name: `${row.crop_type} — ${row.batch_code}` },
      price: { currency: 'INR', value: (Number(row.price_per_kg_paise) / 100).toFixed(2) },
      quantity: { unitized: { measure: { unit: 'kg' } }, minimum: row.min_order_kg, maximum: row.max_order_kg },
      tags: [{ code: 'quality_score', value: String(row.quality_score) }],
    })),
  };
};

module.exports = { getAgristackFarmer, getEnamPrices, getOndcListings };
