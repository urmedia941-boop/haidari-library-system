import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncHandler } from '../utils/http.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [
      todaySales,
      monthSales,
      monthExpenses,
      sectionBreakdown,
      channelBreakdown,
      lowStock,
      topBooks,
      topCafeteria,
      salesTrend,
    ] = await Promise.all([
      query(`SELECT COALESCE(SUM(total),0) AS amount, COUNT(*)::int AS count
               FROM sales WHERE created_at::date = CURRENT_DATE`),
      query(`SELECT COALESCE(SUM(total),0) AS amount, COALESCE(SUM(total - cost_total),0) AS profit
               FROM sales WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)`),
      query(`SELECT COALESCE(SUM(amount),0) AS amount FROM expenses
               WHERE date_trunc('month', spent_at) = date_trunc('month', CURRENT_DATE)`),
      query(`SELECT section, COALESCE(SUM(total),0) AS amount, COALESCE(SUM(total - cost_total),0) AS profit
               FROM sales GROUP BY section`),
      query(`SELECT channel, COALESCE(SUM(total),0) AS amount, COUNT(*)::int AS count
               FROM sales GROUP BY channel`),
      query(`SELECT COUNT(*)::int AS count FROM products
               WHERE is_active = TRUE AND stock_qty <= reorder_level`),
      query(`SELECT si.product_id, si.product_name, SUM(si.quantity)::int AS qty,
                     COALESCE(SUM(si.line_total),0) AS revenue
               FROM sale_items si WHERE si.product_type = 'book' AND si.transaction_type = 'sale'
               GROUP BY si.product_id, si.product_name ORDER BY qty DESC LIMIT 5`),
      query(`SELECT si.product_id, si.product_name, SUM(si.quantity)::int AS qty,
                     COALESCE(SUM(si.line_total),0) AS revenue
               FROM sale_items si WHERE si.product_type = 'cafeteria' AND si.transaction_type = 'sale'
               GROUP BY si.product_id, si.product_name ORDER BY qty DESC LIMIT 5`),
      query(`SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
                     COALESCE(SUM(s.total), 0) AS amount
               FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day') d(day)
               LEFT JOIN sales s ON s.created_at::date = d.day
               GROUP BY d.day ORDER BY d.day`),
    ]);

    res.json({
      today: todaySales.rows[0],
      month: {
        revenue: monthSales.rows[0].amount,
        profit: monthSales.rows[0].profit,
        expenses: monthExpenses.rows[0].amount,
      },
      by_section: sectionBreakdown.rows,
      by_channel: channelBreakdown.rows,
      low_stock_count: lowStock.rows[0].count,
      top_books: topBooks.rows,
      top_cafeteria: topCafeteria.rows,
      sales_trend: salesTrend.rows,
    });
  }),
);

export default router;
