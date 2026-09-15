const crypto = require('crypto');

const { pool } = require('../db');
const logger = require('../utils/logger');
const { stateCode, cropCode } = require('../utils/batchCode');

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

/**
 * Generates the next sequential batch_code for a (state, crop, year) triple. Not perfectly
 * race-safe under high concurrency (the MAX+1 read and the eventual INSERT aren't atomic), but
 * the batches.batch_code UNIQUE constraint is the real backstop — createBatch() catches a
 * collision there and reports 409 BATCH_CODE_CONFLICT rather than silently double-issuing a
 * code. Acceptable trade-off for a single-writer-per-FPO hackathon-scale system.
 */
const nextBatchCode = async (client, state, cropType) => {
  const sCode = stateCode(state);
  const cCode = cropCode(cropType);
  const year = new Date().getFullYear();
  const prefix = `${sCode}-${cCode}-${year}-`;

  const result = await client.query(
    `SELECT MAX(SUBSTRING(batch_code FROM '\\d+$')::integer) AS max_seq FROM batches WHERE batch_code LIKE $1`,
    [`${prefix}%`],
  );
  const nextSeq = (result.rows[0].max_seq || 0) + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
};

/**
 * Creates a batch: generates batch_code + qr_hash, inserts the batch row, and appends
 * BatchCreated + HarvestDataLogged as the first two BIR events — all in one transaction.
 * Only a FARMER (FPO operator) may create a batch; farmer_id is always null (per the schema
 * comment "null if created by FPO" — this project's registration model only creates FPO-level
 * accounts, never individual farmer_profiles rows, see TASK-007/010 notes).
 */
const createBatch = async (user, data) => {
  const client = await pool.connect();
  try {
    const fpoResult = await client.query(`SELECT id FROM fpo_profiles WHERE user_id = $1`, [user.id]);
    if (fpoResult.rows.length === 0) {
      throw apiError(403, 'NOT_AN_FPO_OPERATOR', 'Only registered FPO accounts can create batches.');
    }
    const fpoId = fpoResult.rows[0].id;

    const clusterResult = await client.query(`SELECT id, state FROM clusters WHERE id = $1`, [data.cluster_id]);
    if (clusterResult.rows.length === 0) {
      throw apiError(404, 'CLUSTER_NOT_FOUND', 'Cluster not found.');
    }
    const cluster = clusterResult.rows[0];

    if (data.contract_id) {
      const contractResult = await client.query(
        `SELECT id, fpo_id, quantity_kg, status FROM procurement_contracts WHERE id = $1`,
        [data.contract_id],
      );
      if (contractResult.rows.length === 0) {
        throw apiError(404, 'CONTRACT_NOT_FOUND', 'Contract not found.');
      }
      const contract = contractResult.rows[0];
      if (contract.fpo_id !== fpoId) {
        throw apiError(403, 'CONTRACT_NOT_YOURS', 'This contract does not belong to your FPO.');
      }

      const committedResult = await client.query(
        `SELECT COALESCE(SUM(total_quantity_kg), 0) AS committed FROM batches WHERE contract_id = $1 AND deleted_at IS NULL`,
        [data.contract_id],
      );
      const alreadyCommitted = Number(committedResult.rows[0].committed);
      const newTotal = alreadyCommitted + data.total_quantity_kg;
      const contractQty = Number(contract.quantity_kg);

      if (newTotal > contractQty) {
        // Side-selling detection per BHARATPURE-DB.md: >20% discrepancy against the contracted
        // quantity gets flagged to audit_logs (not blocked outright, unless it exceeds 100%).
        const overagePct = ((newTotal - contractQty) / contractQty) * 100;
        if (overagePct > 20) {
          await client.query(
            `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value)
             VALUES ($1,$2,'CONTRACT_QUANTITY_DISCREPANCY','procurement_contract',$3,$4,$5)`,
            [
              user.id, user.role, data.contract_id,
              JSON.stringify({ contracted_kg: contractQty, already_committed_kg: alreadyCommitted }),
              JSON.stringify({ attempted_new_total_kg: newTotal, overage_pct: overagePct.toFixed(1) }),
            ],
          );
        }
        throw apiError(422, 'QUANTITY_EXCEEDS_CONTRACT', 'This batch would exceed the contracted quantity.');
      }
    }

    const batchCode = await nextBatchCode(client, cluster.state, data.crop_type);
    const batchId = crypto.randomUUID();
    const qrHash = crypto.createHmac('sha256', process.env.QR_SECRET).update(batchId).digest('hex');

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO batches (id, batch_code, cluster_id, fpo_id, farmer_id, contract_id, crop_type, harvest_date,
                             total_quantity_kg, remaining_quantity_kg, status, qr_hash, notes)
       VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$8,'draft',$9,$10)`,
      [
        batchId, batchCode, data.cluster_id, fpoId, data.contract_id ?? null, data.crop_type, data.harvest_date,
        data.total_quantity_kg, qrHash, data.notes ?? null,
      ],
    );
    await addBirEvent(client, batchId, 'BatchCreated', { batch_code: batchCode }, user.id, user.role);
    await addBirEvent(client, batchId, 'HarvestDataLogged', { harvest_date: data.harvest_date, total_quantity_kg: data.total_quantity_kg }, user.id, user.role);
    await client.query('COMMIT');

    logger.info({ action: 'BATCH_CREATED', batchId, batchCode, userId: user.id });
    return { id: batchId, batch_code: batchCode, qr_hash: qrHash, status: 'draft' };
  } catch (err) {
    await client.query('ROLLBACK'); // safe no-op if BEGIN was never reached
    if (err.code === '23505' && err.constraint === 'batches_batch_code_key') {
      throw apiError(409, 'BATCH_CODE_CONFLICT', 'Batch code collision, please retry.');
    }
    if (err.code && err.statusCode) throw err;
    logger.error({ action: 'BATCH_CREATE_FAILED', userId: user.id, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Role-scoped batch listing, per BHARATPURE-API.md: FARMER sees only their own FPO's batches
 * (any status); CONSUMER/BULK_BUYER see only batches actively on the market; ADMIN sees all.
 */
const listBatches = async (user, { status, cropType, page = 1, limit = 20 }) => {
  const conditions = ['deleted_at IS NULL'];
  const params = [];

  if (user.role === 'FARMER') {
    const fpoResult = await pool.query(`SELECT id FROM fpo_profiles WHERE user_id = $1`, [user.id]);
    if (fpoResult.rows.length === 0) return { rows: [], total: 0 };
    params.push(fpoResult.rows[0].id);
    conditions.push(`fpo_id = $${params.length}`);
  } else if (user.role === 'CONSUMER' || user.role === 'BULK_BUYER') {
    conditions.push(`status IN ('listed', 'partially_sold')`);
  }
  // ADMIN: no extra restriction.

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (cropType) {
    params.push(cropType);
    conditions.push(`crop_type = $${params.length}`);
  }

  const offset = (page - 1) * limit;
  const countResult = await pool.query(`SELECT COUNT(*) FROM batches WHERE ${conditions.join(' AND ')}`, params);
  const dataResult = await pool.query(
    `SELECT id, batch_code, crop_type, harvest_date, total_quantity_kg, remaining_quantity_kg, quality_score, status, created_at
     FROM batches WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return { rows: dataResult.rows, total: Number(countResult.rows[0].count) };
};

/**
 * Full batch detail: the batch row, its latest quality test, and the complete BIR event log
 * (oldest first) — the same shape the public QR-scan BIR view uses, per BHARATPURE-DB.md
 * Pattern 1, minus the public-only restriction (this is the authenticated detail route).
 */
const getBatchById = async (batchId, user) => {
  const batchResult = await pool.query(
    `SELECT b.*, c.name AS cluster_name, c.state, c.district
     FROM batches b JOIN clusters c ON c.id = b.cluster_id
     WHERE b.id = $1 AND b.deleted_at IS NULL`,
    [batchId],
  );
  if (batchResult.rows.length === 0) {
    throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
  }
  const batch = batchResult.rows[0];

  if (user.role === 'FARMER') {
    const fpoResult = await pool.query(`SELECT id FROM fpo_profiles WHERE user_id = $1`, [user.id]);
    if (fpoResult.rows.length === 0 || fpoResult.rows[0].id !== batch.fpo_id) {
      throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
    }
  } else if (user.role === 'CONSUMER' || user.role === 'BULK_BUYER') {
    if (!['listed', 'partially_sold', 'sold', 'dispatched', 'delivered'].includes(batch.status)) {
      throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
    }
  }

  const testResult = await pool.query(
    `SELECT tier, result, purity_score, test_parameters, lab_name, tested_at
     FROM quality_tests WHERE batch_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [batchId],
  );
  const eventsResult = await pool.query(
    `SELECT event_type, event_data, actor_role, created_at FROM bir_events WHERE batch_id = $1 ORDER BY created_at ASC`,
    [batchId],
  );

  return { ...batch, latest_test: testResult.rows[0] ?? null, bir_events: eventsResult.rows };
};

/**
 * Soft-deletes a batch. Only the owning FPO (or ADMIN) may delete, and only while the batch
 * hasn't entered the market yet (draft) or failed testing (test_failed) — anything already
 * listed/sold/etc. must never disappear, that would break the trust/audit story.
 */
const deleteBatch = async (batchId, user) => {
  const batchResult = await pool.query(`SELECT fpo_id, status FROM batches WHERE id = $1 AND deleted_at IS NULL`, [batchId]);
  if (batchResult.rows.length === 0) {
    throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
  }
  const batch = batchResult.rows[0];

  if (user.role !== 'ADMIN') {
    const fpoResult = await pool.query(`SELECT id FROM fpo_profiles WHERE user_id = $1`, [user.id]);
    if (fpoResult.rows.length === 0 || fpoResult.rows[0].id !== batch.fpo_id) {
      throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
    }
  }

  if (!['draft', 'test_failed'].includes(batch.status)) {
    throw apiError(422, 'BATCH_CANNOT_BE_DELETED', 'Only draft or rejected batches can be deleted.');
  }

  await pool.query(`UPDATE batches SET deleted_at = NOW() WHERE id = $1`, [batchId]);
  logger.info({ action: 'BATCH_DELETED', batchId, userId: user.id });
  return null;
};

/**
 * ADMIN clears a temperature-breach review flag after manually confirming the batch is still
 * safe to deliver. Mandatory review_notes, per BHARATPURE-CLAUDE.md's admin route spec, written
 * to audit_logs -- this is exactly the kind of state override that must never happen silently.
 * Implemented here (batch.routes.js) rather than deferred to the later Admin-domain task,
 * because TASK-P4-001's own acceptance check requires clearing a breach to prove delivery can
 * proceed afterward -- the route path matches BHARATPURE-API.md's documented Admin route
 * exactly, so this isn't a shortcut that Phase 5 will need to redo, just built a bit early.
 */
const clearTemperatureBreach = async (batchId, admin, reviewNotes) => {
  const batchResult = await pool.query(`SELECT notes FROM batches WHERE id = $1 AND deleted_at IS NULL`, [batchId]);
  if (batchResult.rows.length === 0) {
    throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
  }
  if (batchResult.rows[0].notes !== 'TEMP_BREACH_REVIEW') {
    throw apiError(422, 'NO_BREACH_TO_CLEAR', 'This batch has no temperature breach flagged for review.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE batches SET notes = NULL, updated_at = NOW() WHERE id = $1`, [batchId]);
    await client.query(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1,$2,'TEMPERATURE_BREACH_CLEARED','batch',$3,$4,$5)`,
      [admin.id, admin.role, batchId, JSON.stringify({ notes: 'TEMP_BREACH_REVIEW' }), JSON.stringify({ notes: null, review_notes: reviewNotes })],
    );
    await client.query('COMMIT');
    logger.info({ action: 'TEMPERATURE_BREACH_CLEARED', batchId, adminId: admin.id });
    return { id: batchId, breach_cleared: true };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ action: 'TEMPERATURE_BREACH_CLEAR_FAILED', batchId, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

// The documented batch state machine (BHARATPURE-DB.md) — used by updateStatus below. Most of
// these transitions already happen automatically as a side effect of the relevant domain action
// (quality.service.js's submitTest, listing.service.js's createListing, order.service.js's
// createOrder/markDelivered) — this endpoint exists because 'draft' -> 'pending_test' has no
// other trigger anywhere in the codebase; a farmer has to be able to explicitly submit a batch
// for testing. Also lets ADMIN force other legal transitions when needed.
const ALLOWED_TRANSITIONS = {
  draft: ['pending_test'],
  pending_test: ['test_passed', 'test_failed'],
  test_passed: ['listed'],
  listed: ['partially_sold', 'sold'],
  partially_sold: ['sold'],
  sold: ['dispatched'],
  dispatched: ['delivered'],
  delivered: ['rejected_post_delivery'],
};

const updateBatchStatus = async (batchId, user, newStatus) => {
  const batchResult = await pool.query(`SELECT fpo_id, status FROM batches WHERE id = $1 AND deleted_at IS NULL`, [batchId]);
  if (batchResult.rows.length === 0) {
    throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
  }
  const batch = batchResult.rows[0];

  if (user.role !== 'ADMIN') {
    const fpoResult = await pool.query(`SELECT id FROM fpo_profiles WHERE user_id = $1`, [user.id]);
    if (fpoResult.rows.length === 0 || fpoResult.rows[0].id !== batch.fpo_id) {
      throw apiError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
    }
  }

  const allowedNext = ALLOWED_TRANSITIONS[batch.status] ?? [];
  if (!allowedNext.includes(newStatus)) {
    throw apiError(422, 'INVALID_STATUS_TRANSITION', `Cannot transition batch from '${batch.status}' to '${newStatus}'.`);
  }

  await pool.query(`UPDATE batches SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, batchId]);
  logger.info({ action: 'BATCH_STATUS_UPDATED', batchId, from: batch.status, to: newStatus, userId: user.id });
  return { id: batchId, status: newStatus };
};

module.exports = { createBatch, listBatches, getBatchById, deleteBatch, clearTemperatureBreach, updateBatchStatus };
