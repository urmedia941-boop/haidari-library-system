import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncHandler, badRequest } from '../utils/http.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ----- Categories -----
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const { kind } = req.query;
    const { rows } = kind
      ? await query('SELECT * FROM categories WHERE kind = $1 ORDER BY name', [kind])
      : await query('SELECT * FROM categories ORDER BY kind, name');
    res.json(rows);
  }),
);

router.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const { name, kind } = req.body;
    if (!name) throw badRequest('name is required');
    const { rows } = await query(
      `INSERT INTO categories (name, kind) VALUES ($1, COALESCE($2, 'book')) RETURNING *`,
      [name, kind],
    );
    res.status(201).json(rows[0]);
  }),
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }),
);

// ----- Authors -----
router.get(
  '/authors',
  asyncHandler(async (_req, res) => {
    const { rows } = await query('SELECT * FROM authors ORDER BY name');
    res.json(rows);
  }),
);

router.post(
  '/authors',
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) throw badRequest('name is required');
    const { rows } = await query(
      'INSERT INTO authors (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *',
      [name],
    );
    res.status(201).json(rows[0]);
  }),
);

// ----- Translators -----
router.get(
  '/translators',
  asyncHandler(async (_req, res) => {
    const { rows } = await query('SELECT * FROM translators ORDER BY name');
    res.json(rows);
  }),
);

router.post(
  '/translators',
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) throw badRequest('name is required');
    const { rows } = await query(
      'INSERT INTO translators (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *',
      [name],
    );
    res.status(201).json(rows[0]);
  }),
);

// ----- Suppliers -----
router.get(
  '/suppliers',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT s.*,
              COALESCE(p.purchased, 0)  AS total_purchased,
              COALESCE(pay.paid, 0)     AS total_paid,
              COALESCE(p.purchased, 0) - COALESCE(pay.paid, 0) AS balance
         FROM suppliers s
         LEFT JOIN (SELECT supplier_id, SUM(total_cost) purchased FROM purchases GROUP BY supplier_id) p
                ON p.supplier_id = s.id
         LEFT JOIN (SELECT supplier_id, SUM(amount) paid FROM supplier_payments GROUP BY supplier_id) pay
                ON pay.supplier_id = s.id
        ORDER BY s.name`,
    );
    res.json(rows);
  }),
);

router.post(
  '/suppliers',
  asyncHandler(async (req, res) => {
    const { name, phone, notes } = req.body;
    if (!name) throw badRequest('name is required');
    const { rows } = await query(
      'INSERT INTO suppliers (name, phone, notes) VALUES ($1, $2, $3) RETURNING *',
      [name, phone, notes],
    );
    res.status(201).json(rows[0]);
  }),
);

router.patch(
  '/suppliers/:id',
  asyncHandler(async (req, res) => {
    const { name, phone, notes } = req.body;
    const { rows } = await query(
      `UPDATE suppliers SET name = COALESCE($2, name), phone = COALESCE($3, phone),
              notes = COALESCE($4, notes) WHERE id = $1 RETURNING *`,
      [req.params.id, name, phone, notes],
    );
    res.json(rows[0]);
  }),
);

router.post(
  '/suppliers/:id/payments',
  asyncHandler(async (req, res) => {
    const { amount, note } = req.body;
    if (!amount) throw badRequest('amount is required');
    const { rows } = await query(
      `INSERT INTO supplier_payments (supplier_id, amount, note, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, amount, note, req.user.id],
    );
    res.status(201).json(rows[0]);
  }),
);

export default router;
