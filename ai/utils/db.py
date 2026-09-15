import os

import psycopg2
import psycopg2.extras


def get_connection():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def fetch_orders(order_ids: list[str]) -> list[dict]:
    """Resolves order_ids -> delivery coordinates + total quantity, straight from the same
    Postgres database the Node backend uses. The Node caller (admin.service.js's optimizeRoutes)
    only ever sends order_ids, not a pre-built locations list -- see docs/research/
    ai-service-scope.md for why this service reads the DB directly instead."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT o.id AS order_id, o.delivery_address,
                       COALESCE(SUM(oi.quantity_kg), 0) AS total_kg
                FROM orders o
                LEFT JOIN order_items oi ON oi.order_id = o.id
                WHERE o.id = ANY(%s::uuid[])
                GROUP BY o.id, o.delivery_address
                """,
                (order_ids,),
            )
            return list(cur.fetchall())
    finally:
        conn.close()
