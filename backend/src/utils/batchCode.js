// batch_code pattern: {STATE_CODE}-{CROP_CODE}-{YEAR}-{SEQUENCE}, e.g. MH-TUR-2026-014.
// Per BHARATPURE-DB.md table 9. Neither lookup table is given verbatim in the spec docs (only
// examples like MH/TUR), so both are built from the actual state/crop values seen in the seed
// data and BHARATPURE-CLAUDE.md's crop list, with a safe fallback for anything not in the map
// so batch creation never crashes on an unexpected state/crop string.

const STATE_CODES = {
  'Maharashtra': 'MH',
  'Rajasthan': 'RJ',
  'Himachal Pradesh': 'HP',
  'Gujarat': 'GJ',
  'Karnataka': 'KA',
  'Tamil Nadu': 'TN',
  'Uttar Pradesh': 'UP',
  'Madhya Pradesh': 'MP',
  'Punjab': 'PB',
  'Haryana': 'HR',
  'Bihar': 'BR',
  'West Bengal': 'WB',
  'Andhra Pradesh': 'AP',
  'Telangana': 'TS',
  'Kerala': 'KL',
  'Odisha': 'OD',
};

const CROP_CODES = {
  TURMERIC: 'TUR',
  MUSTARD: 'MUS',
  HONEY: 'HON',
  GROUNDNUT: 'GRN',
  GHEE: 'GHE',
  SPICES: 'SPI',
  OIL: 'OIL',
};

const stateCode = (stateName) => STATE_CODES[stateName] || stateName.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
const cropCode = (cropType) => CROP_CODES[cropType] || cropType.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();

module.exports = { stateCode, cropCode };
