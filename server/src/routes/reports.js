import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncHandler } from '../utils/http.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Shared date filter builder for the sales table (alias `s`).
function salesFilter(req, params) {
  const { from, to, channel, section } = req.query;
  const where = [];
  if (from) { params.push(from); where.push(`s.created_at >= $${params.length}`); }
  if (to) { params.push(to); where.push(`s.created_at < ($${params.length}::date + 1)`); }
  if (channel) { params.push(channel); where.push(`s.channel = $${params.length}`); }
  if (section) { params.push(section); where.push(`s.section = $${params.length}`); }
  return where.length ? `WHERE ${where.join(' AND ')}` : '';
}

// Profit & loss for a period.
router.get(
  '/profit-loss',
  asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const sp = [];
    const sWhere = salesFilter(req, sp);
    const { rows: sales } = await query(
      `SELECT COALESCE(SUM(total),0) AS revenue,
              COALESCE(SUM(cost_total),0) AS cogs,
              COALESCE(SUM(discount_total),0) AS discounts,
              COALESCE(SUM(total - cost_total),0) AS gross_profit
         FROM sales s ${sWhere}`,
      sp,
    );

    const ep = [];
    const eWhere = [];
    if (from) { ep.push(from); eWhere.push(`spent_at >= $${ep.length}`); }
    if (to) { ep.push(to); eWhere.push(`spent_at <= $${ep.length}`); }
    const { rows: exp } = await query(
      `SELECT COALESCE(SUM(amount),0) AS expenses FROM expenses
         ${eWhere.length ? `WHERE ${eWhere.join(' AND ')}` : ''}`,
      ep,
    );

    const revenue = Number(sales[0].revenue);
    const cogs = Number(sales[0].cogs);
    const grossProfit = Number(sales[0].gross_profit);
    const expenses = Number(exp[0].expenses);
    res.json({
      revenue,
      cogs,
      discounts: Number(sales[0].discounts),
      gross_profit: grossProfit,
      expenses,
      net_profit: grossProfit - expenses,
    });
  }),
);

// Sales grouped by product category.
router.get(
  '/sales-by-category',
  asyncHandler(async (req, res) => {
    const params = [];
    const sWhere = salesFilter(req, params);
    const { rows } = await query(
      `SELECT COALESCE(c.name, 'Uncategorized') AS category,
              p.type AS product_type,
              SUM(si.quantity)::int AS qty,
              COALESCE(SUM(si.line_total),0) AS revenue,
              COALESCE(SUM(si.unit_cost * si.quantity),0) AS cost,
              COALESCE(SUM(si.line_total - si.unit_cost * si.quantity),0) AS profit
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         LEFT JOIN products p ON p.id = si.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         ${sWhere}
         GROUP BY c.name, p.type
         ORDER BY revenue DESC`,
      params,
    );
    res.json(rows);
  }),
);

// Daily revenue/profit series.
router.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const params = [];
    const sWhere = salesFilter(req, params);
    const { rows } = await query(
      `SELECT s.created_at::date AS day,
              COUNT(*)::int AS sales_count,
              COALESCE(SUM(s.total),0) AS revenue,
              COALESCE(SUM(s.total - s.cost_total),0) AS profit
         FROM sales s ${sWhere}
         GROUP BY s.created_at::date ORDER BY day DESC`,
      params,
    );
    res.json(rows);
  }),
);

// Website-specific sales report.
router.get(
  '/website',
  asyncHandler(async (req, res) => {
    const params = ['website'];
    const where = ['s.channel = $1'];
    if (req.query.from) { params.push(req.query.from); where.push(`s.created_at >= $${params.length}`); }
    if (req.query.to) { params.push(req.query.to); where.push(`s.created_at < ($${params.length}::date + 1)`); }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const [summary, top] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*)::int AS orders,
                COALESCE(SUM(total - cost_total),0) AS profit
           FROM sales s ${whereSql}`,
        params,
      ),
      query(
        `SELECT si.product_name, SUM(si.quantity)::int AS qty,
                COALESCE(SUM(si.line_total),0) AS revenue
           FROM sale_items si JOIN sales s ON s.id = si.sale_id ${whereSql}
           GROUP BY si.product_name ORDER BY qty DESC LIMIT 10`,
        params,
      ),
    ]);
    res.json({ summary: summary.rows[0], top_products: top.rows });
  }),
);

// Gifted / free-acquired item tracking.
router.get(
  '/gifts',
  asyncHandler(async (_req, res) => {
    const [givenOut, freeIn] = await Promise.all([
      query(
        `SELECT si.product_name, p.type AS product_type, SUM(si.quantity)::int AS qty
           FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
          WHERE si.transaction_type = 'gift'
          GROUP BY si.product_name, p.type ORDER BY qty DESC`,
      ),
      query(
        `SELECT p.name AS product_name, p.type AS product_type, SUM(m.quantity)::int AS qty
           FROM inventory_movements m JOIN products p ON p.id = m.product_id
          WHERE m.movement_type = 'free_in'
          GROUP BY p.name, p.type ORDER BY qty DESC`,
      ),
    ]);
    res.json({ given_as_gift: givenOut.rows, received_free: freeIn.rows });
  }),
);

// Supplier payables.
router.get(
  '/suppliers',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT s.id, s.name,
              COALESCE(p.purchased, 0) AS total_purchased,
              COALESCE(pay.paid, 0) AS total_paid,
              COALESCE(p.purchased, 0) - COALESCE(pay.paid, 0) AS balance
         FROM suppliers s
         LEFT JOIN (SELECT supplier_id, SUM(total_cost) purchased FROM purchases GROUP BY supplier_id) p
                ON p.supplier_id = s.id
         LEFT JOIN (SELECT supplier_id, SUM(amount) paid FROM supplier_payments GROUP BY supplier_id) pay
                ON pay.supplier_id = s.id
        ORDER BY balance DESC`,
    );
    res.json(rows);
  }),
);

export default router;
