const { pool } = require('../db');
const logger = require('../utils/logger');

const apiError = (statusCode, code, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

const DISPUTE_WINDOW_HOURS = 48;

const addBirEvent = (client, batchId, eventType, eventData, actorId, actorRole) =>
  client.query(
    `INSERT INTO bir_events (batch_id, event_type, event_data, actor_id, actor_role) VALUES ($1,$2,$3,$4,$5)`,
    [batchId, eventType, JSON.stringify(eventData), actorId, actorRole],
  );

const createDispute = async (user, data) => {
  const orderResult = await pool.query(`SELECT id, buyer_id, status, actual_delivery_at FROM orders WHERE id = $1`, [data.order_id]);
  if (orderResult.rows.length === 0) {
    throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  const order = orderResult.rows[0];
  if (order.buyer_id !== user.id) {
    throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  if (!order.actual_delivery_at) {
    throw apiError(422, 'ORDER_NOT_DELIVERED', 'This order has not been delivered yet.');
  }
  const hoursSinceDelivery = (Date.now() - new Date(order.actual_delivery_at).getTime()) / (1000 * 60 * 60);
  if (hoursSinceDelivery > DISPUTE_WINDOW_HOURS) {
    throw apiError(422, 'DISPUTE_WINDOW_CLOSED', `Disputes must be raised within ${DISPUTE_WINDOW_HOURS} hours of delivery.`);
  }

  const existingResult = await pool.query(
    `SELECT id FROM disputes WHERE order_id = $1 AND status NOT IN ('resolved', 'dismissed')`,
    [data.order_id],
  );
  if (existingResult.rows.length > 0) {
    throw apiError(409, 'DISPUTE_ALREADY_EXISTS', 'An open dispute already exists for this order.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const disputeResult = await client.query(
      `INSERT INTO disputes (order_id, raised_by, reason_category, description) VALUES ($1,$2,$3,$4) RETURNING id`,
      [data.order_id, user.id, data.reason_category, data.description],
    );
    await client.query(`UPDATE orders SET status = 'disputed' WHERE id = $1`, [data.order_id]);

    const batchesResult = await client.query(`SELECT DISTINCT batch_id FROM order_items WHERE order_id = $1`, [data.order_id]);
    for (const row of batchesResult.rows) {
      // eslint-disable-next-line no-await-in-loop
      await addBirEvent(client, row.batch_id, 'DisputeRaised', { order_id: data.order_id, reason_category: data.reason_category }, user.id, user.role);
    }

    await client.query('COMMIT');
    logger.info({ action: 'DISPUTE_RAISED', disputeId: disputeResult.rows[0].id, orderId: data.order_id });
    return { id: disputeResult.rows[0].id, order_id: data.order_id, status: 'open' };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ action: 'DISPUTE_CREATE_FAILED', orderId: data.order_id, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

const listDisputes = async (user, { status, page = 1, limit = 20 }) => {
  const conditions = [];
  const params = [];
  if (user.role !== 'ADMIN') {
    params.push(user.id);
    conditions.push(`raised_by = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countResult = await pool.query(`SELECT COUNT(*) FROM disputes ${whereClause}`, params);
  const dataResult = await pool.query(
    `SELECT id, order_id, raised_by, reason_category, status, created_at FROM disputes ${whereClause}
     ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows: dataResult.rows, total: Number(countResult.rows[0].count) };
};

const getDisputeById = async (disputeId, user) => {
  const result = await pool.query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);
  if (result.rows.length === 0) {
    throw apiError(404, 'DISPUTE_NOT_FOUND', 'Dispute not found.');
  }
  const dispute = result.rows[0];
  if (user.role !== 'ADMIN' && dispute.raised_by !== user.id) {
    throw apiError(404, 'DISPUTE_NOT_FOUND', 'Dispute not found.');
  }
  const evidenceResult = await pool.query(`SELECT * FROM dispute_evidence WHERE dispute_id = $1 ORDER BY submitted_at ASC`, [disputeId]);
  return { ...dispute, evidence: evidenceResult.rows };
};

const addEvidence = async (disputeId, user, data) => {
  await getDisputeById(disputeId, user); // 404s if not found/not owned
  const result = await pool.query(
    `INSERT INTO dispute_evidence (dispute_id, evidence_type, bir_event_id, file_url, description, submitted_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [disputeId, data.evidence_type, data.bir_event_id ?? null, data.file_url ?? null, data.description ?? null, user.id],
  );
  logger.info({ action: 'DISPUTE_EVIDENCE_ADDED', disputeId, evidenceId: result.rows[0].id });
  return { id: result.rows[0].id };
};

/**
 * ADMIN resolves a dispute. A non-zero refund triggers an escrow adjustment: full refund if it
 * equals the held amount, partial otherwise. Appends DisputeResolved to every batch on the
 * order, mirroring how DisputeRaised was recorded on all of them.
 */
const resolveDispute = async (disputeId, admin, data) => {
  const disputeResult = await pool.query(`SELECT order_id, status FROM disputes WHERE id = $1`, [disputeId]);
  if (disputeResult.rows.length === 0) {
    throw apiError(404, 'DISPUTE_NOT_FOUND', 'Dispute not found.');
  }
  const dispute = disputeResult.rows[0];
  if (['resolved', 'dismissed'].includes(dispute.status)) {
    throw apiError(422, 'DISPUTE_ALREADY_RESOLVED', 'This dispute has already been resolved.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE disputes SET status = $1, resolution = $2, resolved_by = $3, resolved_at = NOW(), refund_amount_paise = $4 WHERE id = $5`,
      [data.outcome === 'dismissed' ? 'dismissed' : 'resolved', data.resolution, admin.id, data.refund_amount_paise ?? 0, disputeId],
    );

    if (data.refund_amount_paise > 0) {
      const escrowResult = await client.query(`SELECT amount_paise FROM escrow_transactions WHERE order_id = $1`, [dispute.order_id]);
      if (escrowResult.rows.length > 0) {
        const isFullRefund = data.refund_amount_paise >= Number(escrowResult.rows[0].amount_paise);
        await client.query(
          `UPDATE escrow_transactions SET status = $1, refunded_at = NOW(), refund_amount_paise = $2, release_triggered_by = 'DISPUTE_RESOLUTION' WHERE order_id = $3`,
          [isFullRefund ? 'refunded' : 'partially_refunded', data.refund_amount_paise, dispute.order_id],
        );
      }
      await client.query(`UPDATE orders SET status = $1, refund_amount_paise = $2 WHERE id = $3`, [
        data.outcome === 'dismissed' ? 'delivered' : 'refunded', data.refund_amount_paise, dispute.order_id,
      ]);
    }

    const batchesResult = await client.query(`SELECT DISTINCT batch_id FROM order_items WHERE order_id = $1`, [dispute.order_id]);
    for (const row of batchesResult.rows) {
      // eslint-disable-next-line no-await-in-loop
      await addBirEvent(client, row.batch_id, 'DisputeResolved', { dispute_id: disputeId, refund_amount_paise: data.refund_amount_paise ?? 0 }, admin.id, admin.role);
    }

    await client.query('COMMIT');
    logger.info({ action: 'DISPUTE_RESOLVED', disputeId, refundAmountPaise: data.refund_amount_paise ?? 0 });
    return { id: disputeId, status: data.outcome === 'dismissed' ? 'dismissed' : 'resolved' };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ action: 'DISPUTE_RESOLVE_FAILED', disputeId, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { createDispute, listDisputes, getDisputeById, addEvidence, resolveDispute };
