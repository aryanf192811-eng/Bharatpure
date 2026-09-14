const QRCode = require('qrcode');

const { pool } = require('../db');
const logger = require('../utils/logger');

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

/**
 * The public BIR view for a scanned QR code, per BHARATPURE-DB.md's "Pattern 1" query —
 * batch + cluster + farmer/FPO + latest-passing quality test + certificate + the full BIR event
 * log, aggregated with json_agg exactly as documented. No price/order data, this is public.
 */
const scanQr = async (qrHash, meta = {}) => {
  const result = await pool.query(
    `SELECT
       b.id AS batch_id, b.batch_code, b.crop_type, b.harvest_date, b.quality_score, b.status,
       b.qr_burned_at,
       c.name AS cluster_name, c.district, c.state, c.latitude, c.longitude,
       fpo.fpo_name,
       qt.tier AS test_tier, qt.result AS test_result, qt.purity_score, qt.test_parameters,
       qc.cert_url, qc.cert_number,
       COALESCE(
         json_agg(
           json_build_object('event_type', be.event_type, 'event_data', be.event_data, 'created_at', be.created_at)
           ORDER BY be.created_at ASC
         ) FILTER (WHERE be.id IS NOT NULL),
         '[]'
       ) AS bir_events
     FROM batches b
     JOIN clusters c ON c.id = b.cluster_id
     LEFT JOIN fpo_profiles fpo ON fpo.id = b.fpo_id
     LEFT JOIN quality_tests qt ON qt.id = (
       SELECT id FROM quality_tests WHERE batch_id = b.id AND result = 'PASS' ORDER BY created_at DESC LIMIT 1
     )
     LEFT JOIN quality_certificates qc ON qc.quality_test_id = qt.id
     LEFT JOIN bir_events be ON be.batch_id = b.id
     WHERE b.qr_hash = $1 AND b.deleted_at IS NULL
     GROUP BY b.id, c.id, fpo.id, qt.tier, qt.result, qt.purity_score, qt.test_parameters, qc.cert_url, qc.cert_number`,
    [qrHash],
  );
  if (result.rows.length === 0) {
    throw apiError(404, 'QR_NOT_FOUND', 'This QR code is not recognized.');
  }
  const batch = result.rows[0];

  // Fire-and-forget-ish, but awaited so a scan is always recorded before responding.
  await pool.query(
    `INSERT INTO bir_events (batch_id, event_type, event_data, actor_id, actor_role) VALUES ($1,'QRScanned',$2,$3,$4)`,
    [batch.batch_id, JSON.stringify({ ip_address: meta.ip_address ?? null }), meta.userId ?? null, meta.userRole ?? 'PUBLIC'],
  );

  return batch;
};

/**
 * Burns a QR (idempotency guard: batches.qr_burned_at and the DB's own partial unique index
 * on bir_events(batch_id) WHERE event_type='QRBurned' both prevent a double-burn, but the
 * application layer must translate that constraint violation into a clean 409, not a raw 500).
 * Only the consumer who actually has a delivered order for this batch (or ADMIN) may burn it.
 */
const burnQr = async (qrHash, user) => {
  const client = await pool.connect();
  try {
    const batchResult = await client.query(`SELECT id, qr_burned_at FROM batches WHERE qr_hash = $1 AND deleted_at IS NULL`, [qrHash]);
    if (batchResult.rows.length === 0) {
      throw apiError(404, 'QR_NOT_FOUND', 'This QR code is not recognized.');
    }
    const batch = batchResult.rows[0];

    if (batch.qr_burned_at !== null) {
      throw apiError(409, 'QR_ALREADY_BURNED', 'This QR code has already been burned.');
    }

    if (user.role !== 'ADMIN') {
      const ownsDelivery = await client.query(
        `SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE oi.batch_id = $1 AND o.buyer_id = $2 LIMIT 1`,
        [batch.id, user.id],
      );
      if (ownsDelivery.rows.length === 0) {
        throw apiError(403, 'NOT_YOUR_BATCH', 'You do not have an order for this batch.');
      }
    }

    await client.query('BEGIN');
    await client.query(`UPDATE batches SET qr_burned_at = NOW() WHERE id = $1`, [batch.id]);
    await client.query(
      `INSERT INTO bir_events (batch_id, event_type, event_data, actor_id, actor_role) VALUES ($1,'QRBurned','{}',$2,$3)`,
      [batch.id, user.id, user.role],
    );
    await client.query('COMMIT');

    logger.info({ action: 'QR_BURNED', batchId: batch.id, userId: user.id });
    return { batch_id: batch.id, burned_at: new Date().toISOString() };
  } catch (err) {
    await client.query('ROLLBACK'); // safe no-op if BEGIN was never reached
    // Belt-and-suspenders: even if two requests race past the qr_burned_at check above, the
    // DB's own partial unique index (idx_bir_qr_burned_unique) catches it as a 23505 here.
    if (err.code === '23505' && err.constraint === 'idx_bir_qr_burned_unique') {
      throw apiError(409, 'QR_ALREADY_BURNED', 'This QR code has already been burned.');
    }
    if (err.code && err.statusCode) throw err;
    logger.error({ action: 'QR_BURN_FAILED', qrHash, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Regenerates the QR as a scannable PNG (base64 data URL) for the batch owner to print/display.
 * The hash itself was already computed at batch-creation time (TASK-P1-001) -- this just
 * re-renders it as an image, it does not create a new hash.
 */
const generateQrImage = async (batchId, user) => {
  const result = await pool.query(`SELECT qr_hash, fpo_id FROM batches WHERE id = $1 AND deleted_at IS NULL`, [batchId]);
  if (result.rows.length === 0) {
    throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
  }
  const batch = result.rows[0];

  if (user.role !== 'ADMIN') {
    const fpoResult = await pool.query(`SELECT id FROM fpo_profiles WHERE user_id = $1`, [user.id]);
    if (fpoResult.rows.length === 0 || fpoResult.rows[0].id !== batch.fpo_id) {
      throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
    }
  }

  const pngDataUrl = await QRCode.toDataURL(batch.qr_hash, { errorCorrectionLevel: 'M', width: 512 });
  return { qr_hash: batch.qr_hash, qr_image_base64: pngDataUrl };
};

module.exports = { scanQr, burnQr, generateQrImage };
