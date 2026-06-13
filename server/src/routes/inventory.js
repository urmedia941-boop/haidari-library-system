import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncHandler } from '../utils/http.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Stock movement history (optionally per product / type / movement_type).
router.get(
  '/movements',
  asyncHandler(async (req, res) => {
    const { product_id, movement_type, from, to } = req.query;
    const where = [];
    const params = [];
    if (product_id) { params.push(product_id); where.push(`m.product_id = $${params.length}`); }
    if (movement_type) { params.push(movement_type); where.push(`m.movement_type = $${params.length}`); }
    if (from) { params.push(from); where.push(`m.created_at >= $${params.length}`); }
    if (to) { params.push(to); where.push(`m.created_at < ($${params.length}::date + 1)`); }
    const { rows } = await query(
      `SELECT m.*, p.name AS product_name, p.type AS product_type, u.full_name AS user_name
         FROM inventory_movements m
         LEFT JOIN products p ON p.id = m.product_id
         LEFT JOIN users u ON u.id = m.created_by
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY m.created_at DESC LIMIT 500`,
      params,
    );
    res.json(rows);
  }),
);

// Products at or below their reorder level.
router.get(
  '/low-stock',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_active = TRUE AND p.stock_qty <= p.reorder_level
        ORDER BY p.stock_qty ASC`,
    );
    res.json(rows);
  }),
);

// Current inventory valuation summary.
router.get(
  '/valuation',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT type,
              COUNT(*)::int            AS product_count,
              COALESCE(SUM(stock_qty), 0)::int AS total_units,
              COALESCE(SUM(stock_qty * cost_price), 0) AS cost_value,
              COALESCE(SUM(stock_qty * sale_price), 0) AS retail_value
         FROM products WHERE is_active = TRUE GROUP BY type`,
    );
    res.json(rows);
  }),
);

export default router;
