import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// Create a purchase: stock-in items from a supplier and record a payable.
// body: { supplier_id, reference, section, amount_paid, note,
//         items: [{ product_id, quantity, unit_cost, acquisition }] }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { supplier_id, reference, section = 'library', amount_paid = 0, note, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      throw badRequest('items is required and must not be empty');
    }

    const purchase = await withTransaction(async (client) => {
      let totalCost = 0;
      const prepared = [];
      for (const item of items) {
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) throw badRequest('each item needs a positive quantity');
        const { rows } = await client.query(
          'SELECT * FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id],
        );
        const product = rows[0];
        if (!product) throw notFound(`Product ${item.product_id} not found`);
        const acquisition = item.acquisition === 'free' ? 'free' : 'purchased';
        const unitCost = acquisition === 'free' ? 0 : round2(item.unit_cost ?? product.cost_price);
        const lineTotal = round2(unitCost * qty);
        totalCost += lineTotal;
        prepared.push({ product, qty, unitCost, lineTotal, acquisition });
      }

      const paid = round2(amount_paid);
      const status = paid >= totalCost ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

      const { rows: pr } = await client.query(
        `INSERT INTO purchases
           (reference, supplier_id, section, total_cost, amount_paid, status, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [reference || null, supplier_id || null, section, round2(totalCost), paid, status,
          note || null, req.user.id],
      );
      const created = pr[0];

      for (const p of prepared) {
        await client.query(
          `INSERT INTO purchase_items
             (purchase_id, product_id, quantity, unit_cost, line_total, acquisition)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [created.id, p.product.id, p.qty, p.unitCost, p.lineTotal, p.acquisition],
        );
        await client.query(
          'UPDATE products SET stock_qty = stock_qty + $2, updated_at = now() WHERE id = $1',
          [p.product.id, p.qty],
        );
        await client.query(
          `INSERT INTO inventory_movements
             (product_id, movement_type, quantity, unit_cost, reference, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [p.product.id, p.acquisition === 'free' ? 'free_in' : 'purchase',
            p.qty, p.unitCost, reference || `purchase #${created.id}`, req.user.id],
        );
      }

      // A purchase that was paid for counts as a supplier payment.
      if (supplier_id && paid > 0) {
        await client.query(
          `INSERT INTO supplier_payments (supplier_id, amount, note, created_by)
           VALUES ($1, $2, $3, $4)`,
          [supplier_id, paid, `payment for purchase #${created.id}`, req.user.id],
        );
      }
      return created;
    });

    res.status(201).json(purchase);
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to, supplier_id } = req.query;
    const where = [];
    const params = [];
    if (from) { params.push(from); where.push(`p.created_at >= $${params.length}`); }
    if (to) { params.push(to); where.push(`p.created_at < ($${params.length}::date + 1)`); }
    if (supplier_id) { params.push(supplier_id); where.push(`p.supplier_id = $${params.length}`); }
    const { rows } = await query(
      `SELECT p.*, s.name AS supplier_name FROM purchases p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY p.created_at DESC LIMIT 500`,
      params,
    );
    res.json(rows);
  }),
);

export default router;
