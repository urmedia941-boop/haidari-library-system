import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncHandler, badRequest } from '../utils/http.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT d.*, p.name AS product_name, c.name AS category_name
         FROM discounts d
         LEFT JOIN products p ON p.id = d.product_id
         LEFT JOIN categories c ON c.id = d.category_id
        ORDER BY d.created_at DESC`,
    );
    res.json(rows);
  }),
);

// Active discounts that currently apply (used by the POS).
router.get(
  '/active',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT * FROM discounts
        WHERE is_active = TRUE
          AND (start_date IS NULL OR start_date <= CURRENT_DATE)
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)`,
    );
    res.json(rows);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, scope, product_id, category_id, discount_type, value, start_date, end_date } = req.body;
    if (!name) throw badRequest('name is required');
    if (!['percentage', 'fixed'].includes(discount_type)) {
      throw badRequest('discount_type must be "percentage" or "fixed"');
    }
    const { rows } = await query(
      `INSERT INTO discounts
         (name, scope, product_id, category_id, discount_type, value, start_date, end_date)
       VALUES ($1, COALESCE($2,'global'), $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, scope, product_id || null, category_id || null, discount_type,
        value || 0, start_date || null, end_date || null],
    );
    res.status(201).json(rows[0]);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { name, value, is_active, start_date, end_date } = req.body;
    const { rows } = await query(
      `UPDATE discounts SET
         name = COALESCE($2, name),
         value = COALESCE($3, value),
         is_active = COALESCE($4, is_active),
         start_date = COALESCE($5, start_date),
         end_date = COALESCE($6, end_date)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name, value, is_active, start_date, end_date],
    );
    res.json(rows[0]);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await query('DELETE FROM discounts WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }),
);

export default router;
