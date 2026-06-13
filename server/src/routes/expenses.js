import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncHandler, badRequest } from '../utils/http.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to, section } = req.query;
    const where = [];
    const params = [];
    if (from) { params.push(from); where.push(`spent_at >= $${params.length}`); }
    if (to) { params.push(to); where.push(`spent_at <= $${params.length}`); }
    if (section) { params.push(section); where.push(`section = $${params.length}`); }
    const { rows } = await query(
      `SELECT * FROM expenses ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY spent_at DESC, id DESC LIMIT 500`,
      params,
    );
    res.json(rows);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { category, description, amount, section, supplier_id, spent_at } = req.body;
    if (!amount) throw badRequest('amount is required');
    const { rows } = await query(
      `INSERT INTO expenses (category, description, amount, section, supplier_id, spent_at, created_by)
       VALUES (COALESCE($1,'general'), $2, $3, COALESCE($4,'general'), $5, COALESCE($6, CURRENT_DATE), $7)
       RETURNING *`,
      [category, description, amount, section, supplier_id || null, spent_at || null, req.user.id],
    );
    res.status(201).json(rows[0]);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }),
);

export default router;
