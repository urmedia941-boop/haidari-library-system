import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

async function nextInvoiceNo(client) {
  const { rows } = await client.query("SELECT nextval(pg_get_serial_sequence('sales','id')) AS n");
  const seq = rows[0].n;
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${stamp}-${String(seq).padStart(5, '0')}`;
}

// Create a sale (POS checkout or website order).
// body: { channel, customer_name, payment_method, note, items: [{ product_id, quantity, discount, transaction_type }] }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { channel = 'store', customer_name, payment_method = 'cash', note, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      throw badRequest('items is required and must not be empty');
    }

    const sale = await withTransaction(async (client) => {
      let subtotal = 0;
      let discountTotal = 0;
      let costTotal = 0;
      const sections = new Set();
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
        if (product.stock_qty < qty) {
          throw badRequest(`Insufficient stock for "${product.name}" (have ${product.stock_qty})`);
        }

        const isGift = item.transaction_type === 'gift';
        const unitPrice = isGift ? 0 : round2(product.sale_price);
        const lineDiscount = isGift ? 0 : round2(item.discount || 0);
        const lineTotal = round2(unitPrice * qty - lineDiscount);

        subtotal += round2(unitPrice * qty);
        discountTotal += lineDiscount;
        costTotal += round2(product.cost_price * qty);
        sections.add(product.type === 'cafeteria' ? 'cafeteria' : 'library');

        prepared.push({ product, qty, unitPrice, lineDiscount, lineTotal, isGift });
      }

      const section = sections.size > 1 ? 'mixed' : [...sections][0];
      const total = round2(subtotal - discountTotal);
      const invoiceNo = await nextInvoiceNo(client);

      const { rows: saleRows } = await client.query(
        `INSERT INTO sales
           (invoice_no, channel, section, cashier_id, customer_name,
            subtotal, discount_total, total, cost_total, payment_method, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [invoiceNo, channel, section, req.user.id, customer_name || null,
          round2(subtotal), round2(discountTotal), total, round2(costTotal),
          payment_method, note || null],
      );
      const createdSale = saleRows[0];

      for (const p of prepared) {
        await client.query(
          `INSERT INTO sale_items
             (sale_id, product_id, product_name, product_type, quantity,
              unit_price, unit_cost, discount, line_total, transaction_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [createdSale.id, p.product.id, p.product.name, p.product.type, p.qty,
            p.unitPrice, p.product.cost_price, p.lineDiscount, p.lineTotal,
            p.isGift ? 'gift' : 'sale'],
        );
        await client.query(
          'UPDATE products SET stock_qty = stock_qty - $2, updated_at = now() WHERE id = $1',
          [p.product.id, p.qty],
        );
        await client.query(
          `INSERT INTO inventory_movements
             (product_id, movement_type, quantity, unit_cost, reference, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [p.product.id, p.isGift ? 'gift_out' : 'sale', -p.qty,
            p.product.cost_price, invoiceNo, req.user.id],
        );
      }

      return createdSale;
    });

    res.status(201).json(sale);
  }),
);

// List sales with filters.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to, channel, section, cashier_id } = req.query;
    const where = [];
    const params = [];
    if (from) { params.push(from); where.push(`s.created_at >= $${params.length}`); }
    if (to) { params.push(to); where.push(`s.created_at < ($${params.length}::date + 1)`); }
    if (channel) { params.push(channel); where.push(`s.channel = $${params.length}`); }
    if (section) { params.push(section); where.push(`s.section = $${params.length}`); }
    if (cashier_id) { params.push(cashier_id); where.push(`s.cashier_id = $${params.length}`); }
    const sql = `
      SELECT s.*, u.full_name AS cashier_name
        FROM sales s
        LEFT JOIN users u ON u.id = s.cashier_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY s.created_at DESC
        LIMIT 500`;
    const { rows } = await query(sql, params);
    res.json(rows);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT s.*, u.full_name AS cashier_name FROM sales s
         LEFT JOIN users u ON u.id = s.cashier_id WHERE s.id = $1`,
      [req.params.id],
    );
    if (!rows[0]) throw notFound('Sale not found');
    const { rows: itemRows } = await query(
      'SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id',
      [req.params.id],
    );
    res.json({ ...rows[0], items: itemRows });
  }),
);

export default router;
