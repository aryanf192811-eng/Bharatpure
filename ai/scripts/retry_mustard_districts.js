// One-off retry for the Mustard districts that fully timed out in pull_ceda_data.js's first
// run (Kota, Alwar, Bharatpur, Ganganagar -- all Rajasthan) -- gentler pacing (3s vs 1.5s) since
// the server was clearly struggling under the first run's load. Appends real rows onto the
// existing ai/data/mustard_historical.csv rather than overwriting it (Hisar's 606 real rows from
// the first run must not be lost).
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = 'https://agmarknet.ceda.ashoka.edu.in';
const START_DATE = '2022-01-01';
const END_DATE = '2024-12-31';
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const postOnce = (urlPath, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const req = https.request(BASE + urlPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    timeout: 45000,
  }, (res) => {
    let d = '';
    res.on('data', (c) => { d += c; });
    res.on('end', () => {
      try { resolve(JSON.parse(d)); } catch (e) { reject(new Error(`Bad JSON: ${d.slice(0, 200)}`)); }
    });
  });
  req.on('error', reject);
  req.on('timeout', () => req.destroy(new Error('request timed out')));
  req.write(data);
  req.end();
});

async function post(urlPath, body) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await postOnce(urlPath, body);
      await sleep(REQUEST_DELAY_MS);
      return result;
    } catch (err) {
      lastErr = err;
      console.log(`  retry ${attempt}/${MAX_RETRIES} for ${urlPath} after: ${err.message}`);
      await sleep(REQUEST_DELAY_MS * attempt * 2);
    }
  }
  throw lastErr;
}

const DISTRICTS = [
  { stateId: 8, stateName: 'Rajasthan', districtId: 127, districtName: 'Kota' },
  { stateId: 8, stateName: 'Rajasthan', districtId: 104, districtName: 'Alwar' },
  { stateId: 8, stateName: 'Rajasthan', districtId: 105, districtName: 'Bharatpur' },
  { stateId: 8, stateName: 'Rajasthan', districtId: 99, districtName: 'Ganganagar' },
];
const COMMODITY_ID = 12; // Mustard
const CROP_TYPE = 'MUSTARD';

const csvEscape = (v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v);

(async () => {
  const newRows = [];
  for (const d of DISTRICTS) {
    const reqBody = { state_id: d.stateId, commodity_id: COMMODITY_ID, district_id: d.districtId, calculation_type: 'd', start_date: START_DATE, end_date: END_DATE };
    try {
      // eslint-disable-next-line no-await-in-loop
      const pricesRes = await post('/api/prices', reqBody);
      // eslint-disable-next-line no-await-in-loop
      const qtyRes = await post('/api/quantities', reqBody);
      const prices = pricesRes.data || [];
      const qtyByDate = new Map((qtyRes.data || []).map((q) => [q.t, q.qty]));
      console.log(`[mustard-retry] ${d.stateName}/${d.districtName}: ${prices.length} price rows, ${qtyByDate.size} quantity rows`);
      for (const p of prices) {
        newRows.push([p.t, d.stateName, d.districtName, d.districtName, CROP_TYPE, qtyByDate.has(p.t) ? qtyByDate.get(p.t) : '', p.p_min, p.p_max, p.p_modal].map(csvEscape).join(','));
      }
    } catch (err) {
      console.log(`[mustard-retry] ${d.stateName}/${d.districtName}: SKIPPED again -- ${err.message}`);
    }
  }

  const csvPath = path.join(__dirname, '..', 'data', 'mustard_historical.csv');
  const existing = fs.readFileSync(csvPath, 'utf-8').trimEnd();
  fs.writeFileSync(csvPath, [existing, ...newRows].join('\n') + '\n');
  console.log(`Appended ${newRows.length} rows to ${csvPath}`);
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
