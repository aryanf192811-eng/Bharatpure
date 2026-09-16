// Pulls real historical Turmeric/Mustard price+arrivals data from CEDA (Ashoka University)'s
// live API, reverse-engineered from their site's own JS bundle -- see chatbot.md's TASK-P7-001
// (round 2) for the exact schema and how it was found. No auth/key needed. Writes
// ai/data/{crop}_historical.csv matching the schema in docs/research/demand-training-pipeline.md.
//
// Run manually: node pull_ceda_data.js (from this directory). Not part of any server startup --
// an offline data-acquisition step, same category as train_demand_model.py.
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = 'https://agmarknet.ceda.ashoka.edu.in';
const START_DATE = '2022-01-01';
const END_DATE = '2024-12-31';

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const postOnce = (urlPath, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const req = https.request(BASE + urlPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    timeout: 30000,
  }, (res) => {
    let d = '';
    res.on('data', (c) => { d += c; });
    res.on('end', () => {
      try { resolve(JSON.parse(d)); } catch (e) { reject(new Error(`Bad JSON from ${urlPath}: ${d.slice(0, 200)}`)); }
    });
  });
  req.on('error', reject);
  req.on('timeout', () => req.destroy(new Error('request timed out')));
  req.write(data);
  req.end();
});

// This is a small public academic server, not built for scripted bulk access -- confirmed live:
// firing price+quantity concurrently for the same district silently returned 0 quantity rows
// (vs 305 in an isolated manual test of the identical request), and the very next sequential
// district call hit a straight 504. So: sequential only, a pause between every call, and retry
// with backoff on failure -- never concurrent, never immediate-retry.
const REQUEST_DELAY_MS = 1500;
const MAX_RETRIES = 3;

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
      await sleep(REQUEST_DELAY_MS * attempt * 2); // backoff
    }
  }
  throw lastErr;
}

// crop_type is what demand_model.py / the rest of BharatPure uses (TURMERIC/MUSTARD, uppercase),
// separate from CEDA's own display name ("Turmeric") which goes unused in the output CSV.
const CROPS = {
  turmeric: {
    commodityId: 39,
    cropType: 'TURMERIC',
    districts: [
      { stateId: 27, stateName: 'Maharashtra', districtId: 531, districtName: 'Sangli' },
      { stateId: 27, stateName: 'Maharashtra', districtId: 512, districtName: 'Hingoli' },
      { stateId: 27, stateName: 'Maharashtra', districtId: 511, districtName: 'Nanded' },
      { stateId: 27, stateName: 'Maharashtra', districtId: 524, districtName: 'Latur' },
      { stateId: 36, stateName: 'Telangana', districtId: 533, districtName: 'Nizamabad' },
    ],
  },
  mustard: {
    commodityId: 12,
    cropType: 'MUSTARD',
    districts: [
      { stateId: 8, stateName: 'Rajasthan', districtId: 127, districtName: 'Kota' },
      { stateId: 8, stateName: 'Rajasthan', districtId: 104, districtName: 'Alwar' },
      { stateId: 8, stateName: 'Rajasthan', districtId: 105, districtName: 'Bharatpur' },
      { stateId: 8, stateName: 'Rajasthan', districtId: 99, districtName: 'Ganganagar' },
      { stateId: 6, stateName: 'Haryana', districtId: 80, districtName: 'Hisar' },
    ],
  },
};

const csvEscape = (v) => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v);

async function pullCrop(cropKey, { commodityId, cropType, districts }) {
  const rows = [];
  for (const d of districts) {
    const reqBody = { state_id: d.stateId, commodity_id: commodityId, district_id: d.districtId, calculation_type: 'd', start_date: START_DATE, end_date: END_DATE };
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential and delayed on purpose, see post()'s comment
      const pricesRes = await post('/api/prices', reqBody);
      // eslint-disable-next-line no-await-in-loop
      const qtyRes = await post('/api/quantities', reqBody);
      const prices = pricesRes.data || [];
      const qtyByDate = new Map((qtyRes.data || []).map((q) => [q.t, q.qty]));
      console.log(`[${cropKey}] ${d.stateName}/${d.districtName}: ${prices.length} price rows, ${qtyByDate.size} quantity rows`);

      for (const p of prices) {
        rows.push({
          date: p.t,
          state: d.stateName,
          district: d.districtName,
          market: d.districtName, // CEDA's API is district-level, not market-level -- no finer granularity available
          crop_type: cropType,
          arrivals_quintals: qtyByDate.has(p.t) ? qtyByDate.get(p.t) : '', // blank, not fabricated, when CEDA has no quantity row for that date
          min_price_rs_quintal: p.p_min,
          max_price_rs_quintal: p.p_max,
          modal_price_rs_quintal: p.p_modal,
        });
      }
    } catch (err) {
      // One district's failure (after MAX_RETRIES) must not lose every other district's real data.
      console.log(`[${cropKey}] ${d.stateName}/${d.districtName}: SKIPPED after retries -- ${err.message}`);
    }
  }

  const header = 'date,state,district,market,crop_type,arrivals_quintals,min_price_rs_quintal,max_price_rs_quintal,modal_price_rs_quintal';
  const lines = rows.map((r) => [r.date, r.state, r.district, r.market, r.crop_type, r.arrivals_quintals, r.min_price_rs_quintal, r.max_price_rs_quintal, r.modal_price_rs_quintal].map(csvEscape).join(','));
  const outPath = path.join(__dirname, '..', 'data', `${cropKey}_historical.csv`);
  fs.writeFileSync(outPath, [header, ...lines].join('\n') + '\n');
  console.log(`[${cropKey}] wrote ${outPath} (${rows.length} total rows)`);
}

(async () => {
  for (const [cropKey, cfg] of Object.entries(CROPS)) {
    // eslint-disable-next-line no-await-in-loop
    await pullCrop(cropKey, cfg);
  }
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
