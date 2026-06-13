import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const PRODUCT_SELECT = `
  SELECT p.*,
         c.name  AS category_name,
         a.name  AS author_name,
         t.name  AS translator_name,
         s.name  AS supplier_name,
         bd.author_id, bd.translator_id, bd.supplier_id,
         bd.isbn, bd.edition, bd.publisher_place
    FROM products p
    LEFT JOIN categories  c  ON c.id = p.category_id
    LEFT JOIN book_details bd ON bd.product_id = p.id
    LEFT JOIN authors     a  ON a.id = bd.author_id
    LEFT JOIN translators t  ON t.id = bd.translator_id
    LEFT JOIN suppliers   s  ON s.id = bd.supplier_id
`;

// Generate a unique numeric barcode (EAN-13-ish, 13 digits).
function generateBarcode() {
  const base = `20${Date.now().toString().slice(-9)}`.padEnd(12, '0').slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

// ----- list with filters -----
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { type, search, category_id, acquisition, intended_use, low_stock } = req.query;
    const where = [];
    const params = [];
    if (type) {
      params.push(type);
      where.push(`p.type = $${params.length}`);
    }
    if (category_id) {
      params.push(category_id);
      where.push(`p.category_id = $${params.length}`);
    }
    if (acquisition) {
      params.push(acquisition);
      where.push(`p.acquisition = $${params.length}`);
    }
    if (intended_use) {
      params.push(intended_use);
      where.push(`p.intended_use = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(p.name ILIKE $${params.length} OR p.barcode ILIKE $${params.length} OR bd.isbn ILIKE $${params.length})`,
      );
    }
    if (low_stock === 'true') {
      where.push('p.stock_qty <= p.reorder_level');
    }
    const sql = `${PRODUCT_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.created_at DESC`;
    const { rows } = await query(sql, params);
    res.json(rows);
  }),
);

router.get(
  '/barcode/:code',
  asyncHandler(async (req, res) => {
    const { rows } = await query(`${PRODUCT_SELECT} WHERE p.barcode = $1`, [req.params.code]);
    if (!rows[0]) throw notFound('No product with this barcode');
    res.json(rows[0]);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id]);
    if (!rows[0]) throw notFound('Product not found');
    res.json(rows[0]);
  }),
);

// ----- create -----
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      type, name, barcode, sku, category_id,
      cost_price, sale_price, stock_qty, reorder_level,
      acquisition, intended_use,
      author_id, translator_id, supplier_id, isbn, edition, publisher_place,
    } = req.body;

    if (!type || !['book', 'cafeteria'].includes(type)) {
      throw badRequest('type must be "book" or "cafeteria"');
    }
    if (!name) throw badRequest('name is required');

    const code = barcode || generateBarcode();
    const initialStock = Number(stock_qty) || 0;

    const product = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products
           (type, name, barcode, sku, category_id, cost_price, sale_price,
            stock_qty, reorder_level, acquisition, intended_use)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,'purchased'),COALESCE($11,'sale'))
         RETURNING *`,
        [type, name, code, sku, category_id || null, cost_price || 0, sale_price || 0,
          initialStock, reorder_level ?? 5, acquisition, intended_use],
      );
      const created = rows[0];

      if (type === 'book') {
        await client.query(
          `INSERT INTO book_details
             (product_id, author_id, translator_id, supplier_id, isbn, edition, publisher_place)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [created.id, author_id || null, translator_id || null, supplier_id || null,
            isbn || null, edition || null, publisher_place || null],
        );
      }

      if (initialStock > 0) {
        await client.query(
          `INSERT INTO inventory_movements
             (product_id, movement_type, quantity, unit_cost, reference, created_by)
           VALUES ($1, $2, $3, $4, 'initial stock', $5)`,
          [created.id, acquisition === 'free' ? 'free_in' : 'purchase',
            initialStock, cost_price || 0, req.user.id],
        );
      }
      return created;
    });

    res.status(201).json(product);
  }),
);

// ----- update -----
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const {
      name, barcode, sku, category_id, cost_price, sale_price, reorder_level,
      acquisition, intended_use, is_active,
      author_id, translator_id, supplier_id, isbn, edition, publisher_place,
    } = req.body;

    const updated = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE products SET
           name = COALESCE($2, name),
           barcode = COALESCE($3, barcode),
           sku = COALESCE($4, sku),
           category_id = $5,
           cost_price = COALESCE($6, cost_price),
           sale_price = COALESCE($7, sale_price),
           reorder_level = COALESCE($8, reorder_level),
           acquisition = COALESCE($9, acquisition),
           intended_use = COALESCE($10, intended_use),
           is_active = COALESCE($11, is_active),
           updated_at = now()
         WHERE id = $1 RETURNING *`,
        [req.params.id, name, barcode, sku, category_id || null, cost_price, sale_price,
          reorder_level, acquisition, intended_use, is_active],
      );
      if (!rows[0]) throw notFound('Product not found');
      const product = rows[0];

      if (product.type === 'book') {
        await client.query(
          `INSERT INTO book_details
             (product_id, author_id, translator_id, supplier_id, isbn, edition, publisher_place)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (product_id) DO UPDATE SET
             author_id = EXCLUDED.author_id,
             translator_id = EXCLUDED.translator_id,
             supplier_id = EXCLUDED.supplier_id,
             isbn = EXCLUDED.isbn,
             edition = EXCLUDED.edition,
             publisher_place = EXCLUDED.publisher_place`,
          [product.id, author_id || null, translator_id || null, supplier_id || null,
            isbn || null, edition || null, publisher_place || null],
        );
      }
      return product;
    });

    res.json(updated);
  }),
);

// ----- stock adjustment -----
router.post(
  '/:id/adjust-stock',
  asyncHandler(async (req, res) => {
    const { quantity, reason } = req.body;
    const qty = Number(quantity);
    if (!qty) throw badRequest('quantity (non-zero) is required');

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        'UPDATE products SET stock_qty = stock_qty + $2, updated_at = now() WHERE id = $1 RETURNING *',
        [req.params.id, qty],
      );
      if (!rows[0]) throw notFound('Product not found');
      await client.query(
        `INSERT INTO inventory_movements
           (product_id, movement_type, quantity, reference, created_by)
         VALUES ($1, 'adjustment', $2, $3, $4)`,
        [req.params.id, qty, reason || 'manual adjustment', req.user.id],
      );
      return rows[0];
    });
    res.json(result);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }),
);

export default router;
