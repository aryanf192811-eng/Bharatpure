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

/**
 * Creates a multi-item order with an atomic escrow hold, per the exact pattern documented in
 * BHARATPURE-DB.md's "KEY SQL PATTERNS" section — the most critical transaction in the whole
 * backend, per BHARATPURE-CLAUDE.md. The stock-safety trick is the conditional UPDATE:
 *   UPDATE batches SET remaining_quantity_kg = remaining_quantity_kg - $qty
 *   WHERE id = $id AND remaining_quantity_kg >= $qty AND status IN ('listed','partially_sold')
 * This IS the row lock (an UPDATE always takes a row-level lock for the duration of the
 * transaction) -- a separate `SELECT ... FOR UPDATE` beforehand would be redundant. If two
 * concurrent transactions both try to decrement the same batch below zero, Postgres serializes
 * them: the second one's UPDATE blocks until the first commits, then re-evaluates the WHERE
 * clause against the now-updated row and correctly returns 0 rows if there isn't enough left.
 *
 * All validation of listing existence/type/min/max happens BEFORE opening the transaction
 * (read-only), so nothing expensive holds a lock. All the item processing loop does under lock
 * is the atomic decrement + inserts.
 */
const createOrder = async (user, data) => {
  // Phase 1: validate every item read-only, before any writes. Collect what we need to know
  // is locked-in "at order time" (price_per_kg_paise) even though the actual DB write for
  // stock happens per-item inside the transaction below.
  const itemPlans = [];
  for (const item of data.items) {
    // eslint-disable-next-line no-await-in-loop -- small, bounded item list; sequential reads are fine and keep error messages item-specific
    const listingResult = await pool.query(
      `SELECT l.id, l.batch_id, l.price_per_kg_paise, l.min_order_kg, l.max_order_kg, l.listing_type, l.status,
              b.fpo_id, b.remaining_quantity_kg
       FROM listings l JOIN batches b ON b.id = l.batch_id
       WHERE l.id = $1 AND l.deleted_at IS NULL AND b.deleted_at IS NULL`,
      [item.listing_id],
    );
    if (listingResult.rows.length === 0) {
      throw apiError(404, 'LISTING_NOT_FOUND', `Listing ${item.listing_id} not found.`);
    }
    const listing = listingResult.rows[0];

    if (listing.status !== 'active') {
      throw apiError(422, 'LISTING_NOT_ACTIVE', `Listing ${item.listing_id} is not active.`);
    }
    const allowedForRole = listing.listing_type === 'OPEN'
      || (listing.listing_type === 'CONSUMER_ONLY' && user.role === 'CONSUMER')
      || (listing.listing_type === 'BULK_ONLY' && user.role === 'BULK_BUYER');
    if (!allowedForRole) {
      throw apiError(422, 'LISTING_TYPE_MISMATCH', `Listing ${item.listing_id} is not available to your account type.`);
    }
    if (item.quantity_kg < Number(listing.min_order_kg)) {
      throw apiError(409, 'MIN_ORDER_NOT_MET', `Minimum order for listing ${item.listing_id} is ${listing.min_order_kg}kg.`);
    }
    if (listing.max_order_kg !== null && item.quantity_kg > Number(listing.max_order_kg)) {
      throw apiError(409, 'MAX_ORDER_EXCEEDED', `Maximum order for listing ${item.listing_id} is ${listing.max_order_kg}kg.`);
    }

    itemPlans.push({
      listingId: listing.id,
      batchId: listing.batch_id,
      fpoId: listing.fpo_id,
      quantityKg: item.quantity_kg,
      pricePerKgPaise: Number(listing.price_per_kg_paise),
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (buyer_id, buyer_role, total_amount_paise, status, delivery_address, delivery_notes)
       VALUES ($1,$2,0,'placed',$3,$4) RETURNING id`,
      [user.id, user.role, JSON.stringify(data.delivery_address), data.delivery_notes ?? null],
    );
    const orderId = orderResult.rows[0].id;

    let totalAmountPaise = 0;
    for (const plan of itemPlans) {
      // The atomic stock-safety decrement -- see function doc comment above.
      // eslint-disable-next-line no-await-in-loop -- each item's decrement must happen in order, inside the one transaction
      const decrementResult = await client.query(
        `UPDATE batches SET remaining_quantity_kg = remaining_quantity_kg - $1, updated_at = NOW()
         WHERE id = $2 AND remaining_quantity_kg >= $1 AND status IN ('listed', 'partially_sold')
         RETURNING remaining_quantity_kg`,
        [plan.quantityKg, plan.batchId],
      );
      if (decrementResult.rows.length === 0) {
        throw apiError(409, 'INSUFFICIENT_STOCK', `Not enough stock remaining for batch on listing ${plan.listingId}.`);
      }
      const remainingKg = Number(decrementResult.rows[0].remaining_quantity_kg);

      // subtotal computed in SQL (ROUND(qty*price)), never in JS -- avoids float drift.
      // eslint-disable-next-line no-await-in-loop
      const itemResult = await client.query(
        `INSERT INTO order_items (order_id, listing_id, batch_id, quantity_kg, price_per_kg_paise, subtotal_paise, allocated_at)
         VALUES ($1,$2,$3,$4,$5, ROUND($4::decimal * $5::bigint), NOW()) RETURNING subtotal_paise`,
        [orderId, plan.listingId, plan.batchId, plan.quantityKg, plan.pricePerKgPaise],
      );
      totalAmountPaise += Number(itemResult.rows[0].subtotal_paise);

      if (remainingKg === 0) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(`UPDATE batches SET status = 'sold', updated_at = NOW() WHERE id = $1`, [plan.batchId]);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await client.query(`UPDATE batches SET status = 'partially_sold', updated_at = NOW() WHERE id = $1 AND status = 'listed'`, [plan.batchId]);
      }

      // eslint-disable-next-line no-await-in-loop
      await addBirEvent(client, plan.batchId, 'OrderAllocated', { order_id: orderId, quantity_kg: plan.quantityKg }, user.id, user.role);
    }

    await client.query(`UPDATE orders SET total_amount_paise = $1 WHERE id = $2`, [totalAmountPaise, orderId]);
    await client.query(
      `INSERT INTO escrow_transactions (order_id, amount_paise, status, payment_reference) VALUES ($1,$2,'held',$3)`,
      [orderId, totalAmountPaise, data.payment_reference ?? null],
    );

    await client.query('COMMIT');
    logger.info({ action: 'ORDER_CREATED', orderId, buyerId: user.id, totalAmountPaise, itemCount: itemPlans.length });
    return { id: orderId, total_amount_paise: totalAmountPaise, status: 'placed', items: itemPlans.length };
  } catch (err) {
    await client.query('ROLLBACK'); // safe no-op if BEGIN was never reached
    if (err.code && err.statusCode) throw err;
    logger.error({ action: 'ORDER_CREATE_FAILED', userId: user.id, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

const listOrders = async (user, { status, page = 1, limit = 20 }) => {
  const conditions = [];
  const params = [];

  if (user.role === 'CONSUMER' || user.role === 'BULK_BUYER') {
    params.push(user.id);
    conditions.push(`buyer_id = $${params.length}`);
  } else if (user.role === 'FARMER') {
    const fpoResult = await pool.query(`SELECT id FROM fpo_profiles WHERE user_id = $1`, [user.id]);
    if (fpoResult.rows.length === 0) return { rows: [], total: 0 };
    params.push(fpoResult.rows[0].id);
    conditions.push(`id IN (SELECT DISTINCT oi.order_id FROM order_items oi JOIN batches b ON b.id = oi.batch_id WHERE b.fpo_id = $${params.length})`);
  }
  // ADMIN: no restriction.

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const countResult = await pool.query(`SELECT COUNT(*) FROM orders ${whereClause}`, params);
  const dataResult = await pool.query(
    `SELECT id, buyer_id, buyer_role, total_amount_paise, status, created_at FROM orders ${whereClause}
     ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows: dataResult.rows, total: Number(countResult.rows[0].count) };
};

const getOrderById = async (orderId, user) => {
  const orderResult = await pool.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (orderResult.rows.length === 0) {
    throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  const order = orderResult.rows[0];

  if (user.role === 'CONSUMER' || user.role === 'BULK_BUYER') {
    if (order.buyer_id !== user.id) {
      throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }
  }

  const itemsResult = await pool.query(
    `SELECT oi.*, b.batch_code, b.crop_type FROM order_items oi JOIN batches b ON b.id = oi.batch_id WHERE oi.order_id = $1`,
    [orderId],
  );
  return { ...order, items: itemsResult.rows };
};

const cancelOrder = async (orderId, user, reason) => {
  const orderResult = await pool.query(`SELECT buyer_id, status FROM orders WHERE id = $1`, [orderId]);
  if (orderResult.rows.length === 0) {
    throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  const order = orderResult.rows[0];
  if (order.buyer_id !== user.id && user.role !== 'ADMIN') {
    throw apiError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }
  if (!['placed', 'confirmed'].includes(order.status)) {
    throw apiError(422, 'ORDER_CANNOT_BE_CANCELLED', 'This order can no longer be cancelled.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE orders SET status = 'cancelled', cancellation_reason = $1 WHERE id = $2`, [reason ?? null, orderId]);

    // Restore stock for every item on this order.
    const items = await client.query(`SELECT batch_id, quantity_kg FROM order_items WHERE order_id = $1`, [orderId]);
    for (const item of items.rows) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `UPDATE batches SET remaining_quantity_kg = remaining_quantity_kg + $1,
                status = CASE WHEN status IN ('sold','partially_sold') THEN 'listed' ELSE status END,
                updated_at = NOW()
         WHERE id = $2`,
        [item.quantity_kg, item.batch_id],
      );
    }

    await client.query(`UPDATE escrow_transactions SET status = 'refunded', refunded_at = NOW(), refund_amount_paise = amount_paise WHERE order_id = $1 AND status = 'held'`, [orderId]);
    await client.query('COMMIT');
    logger.info({ action: 'ORDER_CANCELLED', orderId, userId: user.id });
    return { id: orderId, status: 'cancelled' };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ action: 'ORDER_CANCEL_FAILED', orderId, err: err.message });
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { createOrder, listOrders, getOrderById, cancelOrder };
