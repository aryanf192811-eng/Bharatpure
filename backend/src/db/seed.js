require('dotenv').config();

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const { pool } = require('./index');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = 12;
const DEMO_PASSWORD = 'Test@1234'; // -- SEED DATA: known demo password for all seeded accounts

const qrHash = (batchId) => crypto.createHmac('sha256', process.env.QR_SECRET).update(batchId).digest('hex');

// -- SEED DATA: idempotency helpers. Each upsert checks a natural key first and only inserts
// (and only reports { created: true }) when the row didn't already exist — callers use that
// flag to decide whether to also seed the dependent rows underneath it (profile, BIR events,
// tests, etc.), so re-running this script never duplicates anything.
const upsertCluster = async (client, { name, cropType, state, district, lat, lng, activeFarmers }) => {
  const existing = await client.query(`SELECT id FROM clusters WHERE name = $1`, [name]);
  if (existing.rows.length > 0) return { id: existing.rows[0].id, created: false };
  const result = await client.query(
    `INSERT INTO clusters (name, crop_type, state, district, latitude, longitude, active_farmers)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [name, cropType, state, district, lat, lng, activeFarmers],
  );
  return { id: result.rows[0].id, created: true };
};

const upsertUser = async (client, { phone, email, role, fullName }) => {
  const existing = await client.query(`SELECT id FROM users WHERE phone = $1`, [phone]);
  if (existing.rows.length > 0) return { id: existing.rows[0].id, created: false };
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  const result = await client.query(
    `INSERT INTO users (phone, email, password_hash, role, status, full_name)
     VALUES ($1,$2,$3,$4,'active',$5) RETURNING id`,
    [phone, email ?? null, passwordHash, role, fullName],
  );
  return { id: result.rows[0].id, created: true };
};

const addBirEvent = (client, batchId, eventType, eventData = {}, actorId = null, actorRole = 'SYSTEM') =>
  client.query(
    `INSERT INTO bir_events (batch_id, event_type, event_data, actor_id, actor_role) VALUES ($1,$2,$3,$4,$5)`,
    [batchId, eventType, JSON.stringify(eventData), actorId, actorRole],
  );

const seedClusters = async (client) => {
  const sangli = await upsertCluster(client, {
    name: 'Sangli Turmeric Cluster', cropType: 'TURMERIC', state: 'Maharashtra', district: 'Sangli',
    lat: 16.8524, lng: 74.5815, activeFarmers: 22,
  });
  const kota = await upsertCluster(client, {
    name: 'Kota Mustard Cluster', cropType: 'MUSTARD', state: 'Rajasthan', district: 'Kota',
    lat: 25.2138, lng: 75.8648, activeFarmers: 18,
  });
  const kangra = await upsertCluster(client, {
    name: 'Kangra Honey Cluster', cropType: 'HONEY', state: 'Himachal Pradesh', district: 'Kangra',
    lat: 32.0998, lng: 76.2691, activeFarmers: 14,
  });
  return { sangli, kota, kangra };
};

const upsertColdStorageFacility = async (client, { name, state, district, lat, lng, capacityKg }) => {
  const existing = await client.query(`SELECT id FROM cold_storage_facilities WHERE name = $1`, [name]);
  if (existing.rows.length > 0) return { id: existing.rows[0].id, created: false };
  const result = await client.query(
    `INSERT INTO cold_storage_facilities (name, state, district, latitude, longitude, capacity_kg)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [name, state, district, lat, lng, capacityKg],
  );
  return { id: result.rows[0].id, created: true };
};

// One facility near each seeded cluster (for a short, plausible reroute distance), plus one on
// the Mumbai-Sangli corridor and one hub in each cluster's home state, so a breach anywhere near
// the seeded routes/clusters has a genuinely nearby option rather than only a same-state capital.
const seedColdStorageFacilities = async (client) => {
  const facilities = [
    { name: 'Sangli Cold Storage', state: 'Maharashtra', district: 'Sangli', lat: 16.8667, lng: 74.5667, capacityKg: 50000 },
    { name: 'Kolhapur Cold Storage', state: 'Maharashtra', district: 'Kolhapur', lat: 16.7050, lng: 74.2433, capacityKg: 40000 },
    { name: 'Pune Regional Cold Storage', state: 'Maharashtra', district: 'Pune', lat: 18.5204, lng: 73.8567, capacityKg: 100000 },
    { name: 'Mumbai Cold Storage Hub', state: 'Maharashtra', district: 'Mumbai', lat: 19.0176, lng: 72.8562, capacityKg: 150000 },
    { name: 'Kota Cold Storage', state: 'Rajasthan', district: 'Kota', lat: 25.1800, lng: 75.8300, capacityKg: 40000 },
    { name: 'Jaipur Regional Cold Storage', state: 'Rajasthan', district: 'Jaipur', lat: 26.9124, lng: 75.7873, capacityKg: 90000 },
    { name: 'Kangra Cold Storage', state: 'Himachal Pradesh', district: 'Kangra', lat: 32.1000, lng: 76.2500, capacityKg: 20000 },
    { name: 'Chandigarh Regional Cold Storage', state: 'Punjab', district: 'Chandigarh', lat: 30.7333, lng: 76.7794, capacityKg: 60000 },
  ];
  for (const facility of facilities) {
    // eslint-disable-next-line no-await-in-loop -- small, bounded list; sequential keeps it simple
    await upsertColdStorageFacility(client, facility);
  }
};

const seedUsers = async (client, clusters) => {
  const results = {};

  // -- SEED DATA: FARMER role = FPO operator per the registration model (see TASK-007). 3 FPOs.
  const farmerAccounts = [
    {
      key: 'sangliFarmer', phone: '9000000001', fullName: 'Ravi Kulkarni',
      fpo: { name: 'Sangli Turmeric FPO', regNo: 'MH-FPO-2019-0142', state: 'Maharashtra', district: 'Sangli', crops: ['TURMERIC'] },
      clusterId: clusters.sangli.id,
    },
    {
      key: 'kotaFarmer', phone: '9000000011', fullName: 'Suresh Meena',
      fpo: { name: 'Rajasthan Mustard Collective', regNo: 'RJ-FPO-2018-0087', state: 'Rajasthan', district: 'Kota', crops: ['MUSTARD'] },
      clusterId: clusters.kota.id,
    },
    {
      key: 'kangraFarmer', phone: '9000000021', fullName: 'Anita Thakur',
      fpo: { name: 'Himachal Honey Producers', regNo: 'HP-FPO-2020-0053', state: 'Himachal Pradesh', district: 'Kangra', crops: ['HONEY'] },
      clusterId: clusters.kangra.id,
    },
  ];

  for (const acc of farmerAccounts) {
    const user = await upsertUser(client, { phone: acc.phone, role: 'FARMER', fullName: acc.fullName });
    if (user.created) {
      // Note: cluster_farmers is a M2M between clusters and *individual* farmer_profiles rows —
      // it does not apply here. This FARMER-role account represents the FPO operator itself
      // (per TASK-007's registration model), so only fpo_profiles is created; the cluster's own
      // active_farmers count already carries the aggregate member number.
      const fpoResult = await client.query(
        `INSERT INTO fpo_profiles (user_id, fpo_name, registration_number, state, district, primary_crop_types, member_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [user.id, acc.fpo.name, acc.fpo.regNo, acc.fpo.state, acc.fpo.district, acc.fpo.crops, 0],
      );
      results[acc.key] = { userId: user.id, fpoId: fpoResult.rows[0].id };
    } else {
      const fpoRow = await client.query(`SELECT id FROM fpo_profiles WHERE user_id = $1`, [user.id]);
      results[acc.key] = { userId: user.id, fpoId: fpoRow.rows[0].id };
    }
  }

  const consumer = await upsertUser(client, { phone: '9000000002', email: 'consumer.demo@bharatpure.in', role: 'CONSUMER', fullName: 'Priya Nair' });
  if (consumer.created) {
    await client.query(`INSERT INTO consumer_profiles (user_id, delivery_pincode) VALUES ($1, $2)`, [consumer.id, '110001']);
  }
  results.consumer = { userId: consumer.id };

  const bulkBuyer = await upsertUser(client, { phone: '9000000003', email: 'buyer.demo@bharatpure.in', role: 'BULK_BUYER', fullName: 'Amit Verma' });
  if (bulkBuyer.created) {
    await client.query(
      `INSERT INTO bulk_buyer_profiles (user_id, company_name, gstin, business_type) VALUES ($1,$2,$3,$4)`,
      [bulkBuyer.id, 'Fresh Provisions Pvt Ltd', '27AAAPL1234C1ZV', 'food_processor'],
    );
  }
  results.bulkBuyer = { userId: bulkBuyer.id };

  const logistics = await upsertUser(client, { phone: '9000000004', role: 'LOGISTICS', fullName: 'Manoj Pawar' });
  if (logistics.created) {
    await client.query(
      `INSERT INTO logistics_profiles (user_id, vehicle_type, vehicle_registration_number, base_state, base_city)
       VALUES ($1,$2,$3,$4,$5)`,
      [logistics.id, 'COLD_VAN', 'MH-AB-1234', 'Maharashtra', 'Mumbai'],
    );
  }
  results.logistics = { userId: logistics.id };

  const admin = await upsertUser(client, { phone: '9000000005', email: 'admin.demo@bharatpure.in', role: 'ADMIN', fullName: 'BharatPure Admin' });
  results.admin = { userId: admin.id };

  return results;
};

// -- SEED DATA: 6 batches spanning the full status lifecycle, per BHARATPURE-CLAUDE.md's seed spec.
const seedBatches = async (client, clusters, users) => {
  const existing = await client.query(`SELECT batch_code FROM batches WHERE batch_code = ANY($1)`, [
    ['MH-TUR-2026-014', 'MH-TUR-2026-015', 'RJ-MUS-2026-003', 'HP-HON-2026-007', 'MH-TUR-2026-016', 'RJ-MUS-2026-004'],
  ]);
  const already = new Set(existing.rows.map((r) => r.batch_code));

  const insertBatch = async (batchCode, fields) => {
    if (already.has(batchCode)) return null; // already seeded, skip entirely
    const result = await client.query(
      `INSERT INTO batches (batch_code, cluster_id, fpo_id, crop_type, harvest_date, total_quantity_kg,
                             remaining_quantity_kg, quality_score, status, rejection_reason, qr_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'placeholder') RETURNING id`,
      [
        batchCode, fields.clusterId, fields.fpoId, fields.cropType, fields.harvestDate,
        fields.totalKg, fields.remainingKg, fields.qualityScore ?? null, fields.status, fields.rejectionReason ?? null,
      ],
    );
    const batchId = result.rows[0].id;
    // qr_hash depends on batch_id (HMAC(batch_id, QR_SECRET)), so it's set in a second pass.
    await client.query(`UPDATE batches SET qr_hash = $1 WHERE id = $2`, [qrHash(batchId), batchId]);
    return batchId;
  };

  // MH-TUR-2026-014 — turmeric, 2.5t, purity 94, NABL certified, listed @ Rs188/kg
  const b014 = await insertBatch('MH-TUR-2026-014', {
    clusterId: clusters.sangli.id, fpoId: users.sangliFarmer.fpoId, cropType: 'TURMERIC',
    harvestDate: '2026-08-20', totalKg: 2500, remainingKg: 2500, qualityScore: 94, status: 'listed',
  });
  if (b014) {
    await addBirEvent(client, b014, 'BatchCreated', { batch_code: 'MH-TUR-2026-014' }, users.sangliFarmer.userId, 'FARMER');
    await addBirEvent(client, b014, 'HarvestDataLogged', { harvest_date: '2026-08-20' }, users.sangliFarmer.userId, 'FARMER');
    await addBirEvent(client, b014, 'NABLTestDispatched', { lab: 'AgriQuality Labs, Pune' });
    const test = await client.query(
      `INSERT INTO quality_tests (batch_id, tier, result, purity_score, test_parameters, lab_name, lab_accreditation, tested_at)
       VALUES ($1,'TIER2','PASS',94,$2,'AgriQuality Labs, Pune','NABL-T-1234',NOW() - INTERVAL '10 days') RETURNING id`,
      [b014, JSON.stringify({ curcumin_pct: 4.2, lead_ppm: 0.8, moisture_pct: 9.1 })],
    );
    await addBirEvent(client, b014, 'NABLCertificateLinked', { purity_score: 94 });
    await client.query(
      `INSERT INTO quality_certificates (batch_id, quality_test_id, cert_number, cert_url, file_size_bytes, issued_at, uploaded_by)
       VALUES ($1,$2,'NABL-CERT-2026-0014','/uploads/certs/nabl-cert-2026-0014.pdf',482300,'2026-08-28',$3)`,
      [b014, test.rows[0].id, users.sangliFarmer.userId],
    );
    await addBirEvent(client, b014, 'BatchListed', { price_per_kg_paise: 18800 });
    await client.query(
      `INSERT INTO listings (batch_id, listed_by, price_per_kg_paise, min_order_kg, max_order_kg, listing_type)
       VALUES ($1,$2,18800,0.5,NULL,'OPEN')`,
      [b014, users.sangliFarmer.userId],
    );
  }

  // MH-TUR-2026-015 — turmeric, 1.8t, purity 89, still pending_test (no test row completed yet —
  // per the batches.status CHECK / documented state machine, "pending_test" means testing hasn't
  // resolved to a pass/fail yet; a RapidTestInitiated event reflects it being in progress).
  const b015 = await insertBatch('MH-TUR-2026-015', {
    clusterId: clusters.sangli.id, fpoId: users.sangliFarmer.fpoId, cropType: 'TURMERIC',
    harvestDate: '2026-09-01', totalKg: 1800, remainingKg: 1800, qualityScore: 89, status: 'pending_test',
  });
  if (b015) {
    await addBirEvent(client, b015, 'BatchCreated', { batch_code: 'MH-TUR-2026-015' }, users.sangliFarmer.userId, 'FARMER');
    await addBirEvent(client, b015, 'HarvestDataLogged', { harvest_date: '2026-09-01' }, users.sangliFarmer.userId, 'FARMER');
    await addBirEvent(client, b015, 'RapidTestInitiated', { tier: 'TIER1' });
  }

  // RJ-MUS-2026-003 — mustard oil, 1.2t, purity 91, listed @ Rs142/kg
  const b003 = await insertBatch('RJ-MUS-2026-003', {
    clusterId: clusters.kota.id, fpoId: users.kotaFarmer.fpoId, cropType: 'MUSTARD',
    harvestDate: '2026-07-15', totalKg: 1200, remainingKg: 1200, qualityScore: 91, status: 'listed',
  });
  if (b003) {
    await addBirEvent(client, b003, 'BatchCreated', { batch_code: 'RJ-MUS-2026-003' }, users.kotaFarmer.userId, 'FARMER');
    await addBirEvent(client, b003, 'HarvestDataLogged', { harvest_date: '2026-07-15' }, users.kotaFarmer.userId, 'FARMER');
    await client.query(
      `INSERT INTO quality_tests (batch_id, tier, result, purity_score, test_parameters, tested_at)
       VALUES ($1,'TIER1','PASS',91,$2,NOW() - INTERVAL '15 days')`,
      [b003, JSON.stringify({ erucic_acid_pct: 2.1, moisture_pct: 6.4 })],
    );
    await addBirEvent(client, b003, 'RapidTestPassed', { purity_score: 91 });
    await addBirEvent(client, b003, 'BatchListed', { price_per_kg_paise: 14200 });
    await client.query(
      `INSERT INTO listings (batch_id, listed_by, price_per_kg_paise, min_order_kg, max_order_kg, listing_type)
       VALUES ($1,$2,14200,1.0,NULL,'OPEN')`,
      [b003, users.kotaFarmer.userId],
    );
  }

  // HP-HON-2026-007 — honey, 0.8t, NMR passed, purity 97, listed @ Rs380/kg
  const b007 = await insertBatch('HP-HON-2026-007', {
    clusterId: clusters.kangra.id, fpoId: users.kangraFarmer.fpoId, cropType: 'HONEY',
    harvestDate: '2026-06-10', totalKg: 800, remainingKg: 800, qualityScore: 97, status: 'listed',
  });
  if (b007) {
    await addBirEvent(client, b007, 'BatchCreated', { batch_code: 'HP-HON-2026-007' }, users.kangraFarmer.userId, 'FARMER');
    await addBirEvent(client, b007, 'HarvestDataLogged', { harvest_date: '2026-06-10' }, users.kangraFarmer.userId, 'FARMER');
    await addBirEvent(client, b007, 'NABLTestDispatched', { lab: 'FoodSafe NMR Labs, Delhi', method: 'NMR' });
    const test = await client.query(
      `INSERT INTO quality_tests (batch_id, tier, result, purity_score, test_parameters, lab_name, lab_accreditation, tested_at)
       VALUES ($1,'TIER2','PASS',97,$2,'FoodSafe NMR Labs, Delhi','NABL-T-5566',NOW() - INTERVAL '20 days') RETURNING id`,
      [b007, JSON.stringify({ method: 'NMR', adulteration_pct: 0.4, moisture_pct: 17.2 })],
    );
    await addBirEvent(client, b007, 'NABLCertificateLinked', { purity_score: 97 });
    await client.query(
      `INSERT INTO quality_certificates (batch_id, quality_test_id, cert_number, cert_url, file_size_bytes, issued_at, uploaded_by)
       VALUES ($1,$2,'NABL-CERT-2026-0007','/uploads/certs/nabl-cert-2026-0007.pdf',397100,'2026-06-25',$3)`,
      [b007, test.rows[0].id, users.kangraFarmer.userId],
    );
    await addBirEvent(client, b007, 'BatchListed', { price_per_kg_paise: 38000 });
    await client.query(
      `INSERT INTO listings (batch_id, listed_by, price_per_kg_paise, min_order_kg, max_order_kg, listing_type)
       VALUES ($1,$2,38000,0.25,NULL,'OPEN')`,
      [b007, users.kangraFarmer.userId],
    );
  }

  // MH-TUR-2026-016 — turmeric, 0.9t, REJECTED (lead above limit), public rejection logged
  const b016 = await insertBatch('MH-TUR-2026-016', {
    clusterId: clusters.sangli.id, fpoId: users.sangliFarmer.fpoId, cropType: 'TURMERIC',
    harvestDate: '2026-08-05', totalKg: 900, remainingKg: 900, qualityScore: 42, status: 'test_failed',
    rejectionReason: 'Lead content (3.4 ppm) exceeds the FSSAI safe limit (2.5 ppm) for spices.',
  });
  if (b016) {
    await addBirEvent(client, b016, 'BatchCreated', { batch_code: 'MH-TUR-2026-016' }, users.sangliFarmer.userId, 'FARMER');
    await addBirEvent(client, b016, 'HarvestDataLogged', { harvest_date: '2026-08-05' }, users.sangliFarmer.userId, 'FARMER');
    await addBirEvent(client, b016, 'NABLTestDispatched', { lab: 'AgriQuality Labs, Pune' });
    await client.query(
      `INSERT INTO quality_tests (batch_id, tier, result, purity_score, test_parameters, lab_name, lab_accreditation, tested_at)
       VALUES ($1,'TIER2','FAIL',42,$2,'AgriQuality Labs, Pune','NABL-T-1234',NOW() - INTERVAL '12 days')`,
      [b016, JSON.stringify({ curcumin_pct: 3.1, lead_ppm: 3.4, moisture_pct: 11.8 })],
    );
    await addBirEvent(client, b016, 'BatchRejected', { reason: 'Lead ppm above FSSAI limit', lead_ppm: 3.4 });
  }

  // RJ-MUS-2026-004 — mustard oil, 2.0t, delivered, sold to the seeded bulk buyer
  const b004 = await insertBatch('RJ-MUS-2026-004', {
    clusterId: clusters.kota.id, fpoId: users.kotaFarmer.fpoId, cropType: 'MUSTARD',
    harvestDate: '2026-05-20', totalKg: 2000, remainingKg: 0, qualityScore: 88, status: 'delivered',
  });
  if (b004) {
    const pricePerKgPaise = 14500;
    const quantityKg = 2000;
    const subtotalPaise = Math.round(quantityKg * pricePerKgPaise);

    await addBirEvent(client, b004, 'BatchCreated', { batch_code: 'RJ-MUS-2026-004' }, users.kotaFarmer.userId, 'FARMER');
    await addBirEvent(client, b004, 'HarvestDataLogged', { harvest_date: '2026-05-20' }, users.kotaFarmer.userId, 'FARMER');
    await client.query(
      `INSERT INTO quality_tests (batch_id, tier, result, purity_score, test_parameters, tested_at)
       VALUES ($1,'TIER1','PASS',88,$2,NOW() - INTERVAL '60 days')`,
      [b004, JSON.stringify({ erucic_acid_pct: 2.4, moisture_pct: 6.9 })],
    );
    await addBirEvent(client, b004, 'RapidTestPassed', { purity_score: 88 });
    await addBirEvent(client, b004, 'BatchListed', { price_per_kg_paise: pricePerKgPaise });
    const listing = await client.query(
      `INSERT INTO listings (batch_id, listed_by, price_per_kg_paise, min_order_kg, max_order_kg, listing_type, status)
       VALUES ($1,$2,$3,10,NULL,'BULK_ONLY','sold_out') RETURNING id`,
      [b004, users.kotaFarmer.userId, pricePerKgPaise],
    );

    const order = await client.query(
      `INSERT INTO orders (buyer_id, buyer_role, total_amount_paise, status, delivery_address, estimated_delivery_at, actual_delivery_at)
       VALUES ($1,'BULK_BUYER',$2,'delivered',$3,NOW() - INTERVAL '25 days',NOW() - INTERVAL '24 days') RETURNING id`,
      [
        users.bulkBuyer.userId, subtotalPaise,
        JSON.stringify({ line1: 'Plot 14, MIDC Industrial Area', line2: 'Andheri East', city: 'Mumbai', state: 'Maharashtra', pincode: '400093', lat: 19.1197, lng: 72.8697 }),
      ],
    );
    await client.query(
      `INSERT INTO order_items (order_id, listing_id, batch_id, quantity_kg, price_per_kg_paise, subtotal_paise, allocated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW() - INTERVAL '26 days')`,
      [order.rows[0].id, listing.rows[0].id, b004, quantityKg, pricePerKgPaise, subtotalPaise],
    );
    await addBirEvent(client, b004, 'OrderAllocated', { order_id: order.rows[0].id, quantity_kg: quantityKg });
    await addBirEvent(client, b004, 'DispatchedToHub', {});
    await addBirEvent(client, b004, 'DeliveredToConsumer', { order_id: order.rows[0].id });
    await client.query(
      `INSERT INTO escrow_transactions (order_id, amount_paise, status, payment_reference, held_at, released_at, release_triggered_by)
       VALUES ($1,$2,'released','UPI-SEED-DEMO-0004',NOW() - INTERVAL '26 days',NOW() - INTERVAL '24 days','BIR_EVENT')`,
      [order.rows[0].id, subtotalPaise],
    );
    await addBirEvent(client, b004, 'EscrowReleased', { amount_paise: subtotalPaise });
  }
};

// -- SEED DATA: synthetic 12-month demand forecast horizon for 3 crop/city pairs, matching the
// seasonal narrative in BHARATPURE-CLAUDE.md (Navratri turmeric spike in Delhi, honey festival
// peaks in Mumbai, winter mustard-oil spike in Ahmedabad). One row per month, not per day —
// demand_forecasts is a 6-hourly-refreshed cache in production; 12 monthly points is enough to
// drive the demand-intelligence UI for a demo without seeding hundreds of daily rows.
const seedDemandForecasts = async (client) => {
  const MODEL_VERSION = 'seed_synthetic_v1';
  const combos = [
    {
      cropType: 'TURMERIC', city: 'Delhi', base: 500,
      seasonality: (month) => (month === 9 ? 1.6 : month >= 5 && month <= 7 ? 0.7 : 1.0), // Oct (idx9) Navratri spike, Jun-Aug monsoon dip
      driver: (month) => (month === 9 ? 'navratri_festival_spike' : month >= 5 && month <= 7 ? 'monsoon_dip' : 'seasonal_baseline'),
    },
    {
      cropType: 'HONEY', city: 'Mumbai', base: 200,
      seasonality: (month) => (month === 9 || month === 10 ? 1.5 : month === 7 ? 1.3 : 1.0), // Oct/Nov Diwali, Aug Onam
      driver: (month) => (month === 9 || month === 10 ? 'diwali_festival_peak' : month === 7 ? 'onam_festival_peak' : 'seasonal_baseline'),
    },
    {
      cropType: 'MUSTARD', city: 'Ahmedabad', base: 800,
      seasonality: (month) => (month >= 10 || month <= 1 ? 1.4 : 1.0), // Nov-Feb winter cooking season
      driver: (month) => (month >= 10 || month <= 1 ? 'winter_cooking_season' : 'seasonal_baseline'),
    },
  ];

  const now = new Date();
  for (const combo of combos) {
    for (let i = 0; i < 12; i += 1) {
      const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthIdx = forecastDate.getMonth();
      const multiplier = combo.seasonality(monthIdx);
      const predictedKg = Math.round(combo.base * multiplier);
      const rangeLow = Math.round(predictedKg * 0.85);
      const rangeHigh = Math.round(predictedKg * 1.15);
      const driver = combo.driver(monthIdx);

      await client.query(
        `INSERT INTO demand_forecasts (crop_type, city, forecast_date, predicted_kg, confidence_pct, range_low_kg, range_high_kg, demand_drivers, model_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (crop_type, city, forecast_date, model_version) DO NOTHING`,
        [
          combo.cropType, combo.city, forecastDate.toISOString().slice(0, 10), predictedKg, 78.0, rangeLow, rangeHigh,
          JSON.stringify([{ factor: driver, contribution_pct: driver === 'seasonal_baseline' ? 100 : 65 }]),
          MODEL_VERSION,
        ],
      );
    }
  }
};

const seed = async () => {
  const client = await pool.connect();
  try {
    const clusters = await seedClusters(client);
    const users = await seedUsers(client, clusters);
    await seedBatches(client, clusters, users);
    await seedDemandForecasts(client);
    await seedColdStorageFacilities(client);

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM clusters) AS clusters,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM batches) AS batches,
        (SELECT COUNT(*) FROM bir_events) AS bir_events,
        (SELECT COUNT(*) FROM demand_forecasts) AS demand_forecasts,
        (SELECT COUNT(*) FROM cold_storage_facilities) AS cold_storage_facilities
    `);
    logger.info({ action: 'SEED_COMPLETE', ...counts.rows[0] });
    console.log('Seed complete:', counts.rows[0]);
    console.log(`Demo password for all seeded accounts: ${DEMO_PASSWORD}`);
  } catch (err) {
    logger.error({ action: 'SEED_FAILED', err: err.message, stack: err.stack });
    throw err;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = { seed };
