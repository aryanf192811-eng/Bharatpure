const fs = require('fs');
const path = require('path');

const { pool } = require('../db');
const logger = require('../utils/logger');

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

const addBirEvent = (client, batchId, eventType, eventData, actorId, actorRole) =>
  client.query(
    `INSERT INTO bir_events (batch_id, event_type, event_data, actor_id, actor_role) VALUES ($1,$2,$3,$4,$5)`,
    [batchId, eventType, JSON.stringify(eventData), actorId, actorRole],
  );

const BSAMPLE_WINDOW_DAYS = 7;

/**
 * Submits a quality test result. Which BIR event fires, and what happens to the batch/b-sample
 * flow, depends on tier + result — resolved as follows (see TASK-P1-002 Result/Notes for the
 * full reasoning, this is the short version):
 *   TIER1 PASS -> RapidTestPassed, batch -> test_passed
 *   TIER1 FAIL -> RapidTestFailed, batch -> test_failed, auto-creates a b_sample_requests row
 *                 (7-day window) so the farmer can request NABL referee testing
 *   TIER2 PASS -> batch -> test_passed; no distinct BIR event fires yet -- NABLCertificateLinked
 *                 (fired by uploadCertificate below) is the documented event for a TIER2 pass,
 *                 there is no separate "NABLTestPassed" in the event_type CHECK list
 *   TIER2 FAIL -> BatchRejected, batch -> test_failed + rejection_reason set. No b_sample row:
 *                 TIER2/NABL is already the referee tier, there's nothing higher to appeal to
 *                 (this task's own spec text says "TIER2 FAIL creates b_sample_requests", but
 *                 that contradicts both this task's own acceptance check, which tests a TIER1
 *                 fail, and BHARATPURE-DB.md's documented business rule -- "When TIER1 fails,
 *                 farmer can request independent NABL verification". Resolved in favor of the
 *                 two agreeing sources.)
 */
const submitTest = async (batchId, user, data) => {
  const client = await pool.connect();
  try {
    const batchResult = await client.query(`SELECT id, status, fpo_id FROM batches WHERE id = $1 AND deleted_at IS NULL`, [batchId]);
    if (batchResult.rows.length === 0) {
      throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
    }
    const batch = batchResult.rows[0];

    if (data.tier === 'TIER1') {
      if (batch.status !== 'pending_test') {
        throw apiError(422, 'BATCH_WRONG_STATUS', 'This batch is not awaiting a quality test.');
      }
    } else {
      // TIER2 (NABL) always follows a resolved TIER1 -- by the time it's submitted the batch has
      // already left 'pending_test' (TIER1 PASS/FAIL both move it out). Per BHARATPURE-DB.md:
      // "TIER2 always supersedes TIER1", so it must be submittable from test_passed or test_failed,
      // not just pending_test. Checked before the status guard below so skipping TIER1 entirely
      // reports the more specific INVALID_TIER2_WITHOUT_TIER1 rather than a generic wrong-status.
      const priorTier1 = await client.query(`SELECT id FROM quality_tests WHERE batch_id = $1 AND tier = 'TIER1'`, [batchId]);
      if (priorTier1.rows.length === 0) {
        throw apiError(400, 'INVALID_TIER2_WITHOUT_TIER1', 'A TIER1 rapid test must exist before a TIER2 NABL test.');
      }
      if (!['test_passed', 'test_failed'].includes(batch.status)) {
        throw apiError(422, 'BATCH_WRONG_STATUS', 'This batch has no resolved TIER1 result yet.');
      }
    }

    await client.query('BEGIN');

    const testResult = await client.query(
      `INSERT INTO quality_tests (batch_id, tier, result, purity_score, test_parameters, lab_name, lab_accreditation, tested_at, tested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8) RETURNING id`,
      [batchId, data.tier, data.result, data.purity_score ?? null, JSON.stringify(data.test_parameters ?? {}), data.lab_name ?? null, data.lab_accreditation ?? null, user.id],
    );
    const qualityTestId = testResult.rows[0].id;

    await client.query(`UPDATE batches SET quality_score = $1, updated_at = NOW() WHERE id = $2`, [data.purity_score ?? null, batchId]);

    if (data.tier === 'TIER1' && data.result === 'PASS') {
      await client.query(`UPDATE batches SET status = 'test_passed' WHERE id = $1`, [batchId]);
      await addBirEvent(client, batchId, 'RapidTestPassed', { purity_score: data.purity_score }, user.id, user.role);
    } else if (data.tier === 'TIER1' && data.result === 'FAIL') {
      await client.query(`UPDATE batches SET status = 'test_failed' WHERE id = $1`, [batchId]);
      await addBirEvent(client, batchId, 'RapidTestFailed', { purity_score: data.purity_score }, user.id, user.role);

      const fpoOwnerResult = await client.query(`SELECT user_id FROM fpo_profiles WHERE id = $1`, [batch.fpo_id]);
      await client.query(
        `INSERT INTO b_sample_requests (batch_id, quality_test_id, requested_by, request_window_end, status)
         VALUES ($1,$2,$3, NOW() + INTERVAL '${BSAMPLE_WINDOW_DAYS} days', 'pending')`,
        [batchId, qualityTestId, fpoOwnerResult.rows[0].user_id],
      );
    } else if (data.tier === 'TIER2' && data.result === 'PASS') {
      await client.query(`UPDATE batches SET status = 'test_passed' WHERE id = $1`, [batchId]);
      // No BIR event here on purpose -- see the function doc comment above.
    } else if (data.tier === 'TIER2' && data.result === 'FAIL') {
      await client.query(`UPDATE batches SET status = 'test_failed', rejection_reason = $1 WHERE id = $2`, [
        data.rejection_reason ?? 'NABL test result: FAIL', batchId,
      ]);
      await addBirEvent(client, batchId, 'BatchRejected', { purity_score: data.purity_score, tier: 'TIER2' }, user.id, user.role);
    }

    await client.query('COMMIT');
    logger.info({ action: 'QUALITY_TEST_SUBMITTED', batchId, tier: data.tier, result: data.result });
    return { id: qualityTestId, batch_id: batchId, tier: data.tier, result: data.result };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code && err.statusCode) throw err;
    logger.error({ action: 'QUALITY_TEST_FAILED', batchId, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Saves an uploaded NABL certificate PDF (already validated/stored on disk by multer at this
 * point) and links it to the batch via the NABLCertificateLinked BIR event -- the documented
 * marker for a TIER2 pass, since submitTest() deliberately doesn't fire one itself.
 */
const uploadCertificate = async (batchId, user, file, meta) => {
  const client = await pool.connect();
  try {
    const testResult = await client.query(
      `SELECT id FROM quality_tests WHERE batch_id = $1 AND tier = 'TIER2' AND result = 'PASS' ORDER BY created_at DESC LIMIT 1`,
      [batchId],
    );
    if (testResult.rows.length === 0) {
      throw apiError(422, 'NO_PASSING_TIER2_TEST', 'No passing NABL (TIER2) test found for this batch.');
    }

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO quality_certificates (batch_id, quality_test_id, cert_number, cert_url, file_size_bytes, mime_type, issued_at, expires_at, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        batchId, testResult.rows[0].id, meta.cert_number, file.path.replace(/\\/g, '/'), file.size, file.mimetype,
        meta.issued_at, meta.expires_at ?? null, user.id,
      ],
    );
    await addBirEvent(client, batchId, 'NABLCertificateLinked', { cert_number: meta.cert_number }, user.id, user.role);
    await client.query('COMMIT');

    logger.info({ action: 'CERTIFICATE_UPLOADED', batchId, certNumber: meta.cert_number });
    return { cert_number: meta.cert_number, cert_url: file.path.replace(/\\/g, '/') };
  } catch (err) {
    await client.query('ROLLBACK');
    fs.unlink(file.path, () => {}); // don't leave an orphaned file on disk if the DB write failed
    if (err.code === '23505' && err.constraint === 'quality_certificates_cert_number_key') {
      throw apiError(409, 'CERT_NUMBER_EXISTS', 'This certificate number is already in use.');
    }
    if (err.code && err.statusCode) throw err;
    logger.error({ action: 'CERTIFICATE_UPLOAD_FAILED', batchId, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

const getBatchTests = async (batchId) => {
  const result = await pool.query(
    `SELECT id, tier, result, purity_score, test_parameters, lab_name, lab_accreditation, tested_at, created_at
     FROM quality_tests WHERE batch_id = $1 ORDER BY created_at DESC`,
    [batchId],
  );
  return result.rows;
};

const getCertificatesForBatch = async (batchId) => {
  const result = await pool.query(
    `SELECT id, cert_number, file_size_bytes, mime_type, issued_at, expires_at, uploaded_at
     FROM quality_certificates WHERE batch_id = $1 ORDER BY uploaded_at DESC`,
    [batchId],
  );
  return result.rows;
};

/** Any authenticated user may download -- per BHARATPURE-API.md this isn't owner-restricted
 * (a certificate is proof for buyers/consumers just as much as the farmer who uploaded it). */
const getCertificateFile = async (certId) => {
  const result = await pool.query(`SELECT cert_url, cert_number, mime_type FROM quality_certificates WHERE id = $1`, [certId]);
  if (result.rows.length === 0) {
    throw apiError(404, 'CERTIFICATE_NOT_FOUND', 'Certificate not found.');
  }
  return result.rows[0];
};

const getBSampleRequests = async (batchId) => {
  const result = await pool.query(
    `SELECT id, quality_test_id, requested_by, request_window_end, status, selected_lab, result, cost_paid_by, created_at
     FROM b_sample_requests WHERE batch_id = $1 ORDER BY created_at DESC`,
    [batchId],
  );
  return result.rows;
};

/**
 * Farmer formally escalates a pending b-sample entry by naming a lab -- transitions
 * pending -> lab_selected. The row itself was already auto-created by submitTest() on a TIER1
 * fail; this is the "I want to actually use this window" step.
 */
const requestBSample = async (batchId, user, selectedLab) => {
  const result = await pool.query(
    `SELECT id, status, request_window_end FROM b_sample_requests WHERE batch_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [batchId],
  );
  if (result.rows.length === 0) {
    throw apiError(400, 'NO_BSAMPLE_FOR_THIS_BATCH', 'No B-sample window exists for this batch.');
  }
  const bsample = result.rows[0];
  if (new Date(bsample.request_window_end) <= new Date()) {
    throw apiError(422, 'BSAMPLE_WINDOW_CLOSED', 'The 7-day B-sample request window has closed.');
  }
  if (bsample.status !== 'pending') {
    throw apiError(422, 'BSAMPLE_ALREADY_ACTIONED', 'This B-sample request has already been actioned.');
  }

  await pool.query(`UPDATE b_sample_requests SET status = 'lab_selected', selected_lab = $1, updated_at = NOW() WHERE id = $2`, [
    selectedLab, bsample.id,
  ]);
  logger.info({ action: 'BSAMPLE_REQUESTED', batchId, userId: user.id });
  return { id: bsample.id, status: 'lab_selected', selected_lab: selectedLab };
};

module.exports = {
  submitTest,
  getBatchTests,
  uploadCertificate,
  getCertificatesForBatch,
  getCertificateFile,
  getBSampleRequests,
  requestBSample,
};
