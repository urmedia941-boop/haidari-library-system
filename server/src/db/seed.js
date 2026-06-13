import bcrypt from 'bcryptjs';
import { pool, query, withTransaction } from './pool.js';

function code(n) {
  const base = `20${String(n).padStart(10, '0')}`.slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  return base + ((10 - (sum % 10)) % 10);
}

async function seed() {
  console.log('Seeding database...');

  // Users
  const adminHash = bcrypt.hashSync('admin123', 10);
  const cashierHash = bcrypt.hashSync('cashier123', 10);
  await query(
    `INSERT INTO users (username, password_hash, full_name, role) VALUES
       ('admin', $1, 'بەڕێوەبەری سیستەم', 'admin'),
       ('cashier', $2, 'کاشێری کافتریا', 'cashier')
     ON CONFLICT (username) DO NOTHING`,
    [adminHash, cashierHash],
  );

  // Categories
  await query(
    `INSERT INTO categories (name, kind) VALUES
       ('ڕۆمان', 'book'), ('مێژوو', 'book'), ('زانست', 'book'), ('منداڵان', 'book'),
       ('قاوە', 'cafeteria'), ('چای', 'cafeteria'), ('شیرینی', 'cafeteria'),
       ('خواردنەوەی سارد', 'cafeteria')
     ON CONFLICT (name, kind) DO NOTHING`,
  );

  await query(
    `INSERT INTO authors (name) VALUES ('شێرکۆ بێکەس'), ('عەبدوڵا گۆران'), ('فرانتس کافکا')
     ON CONFLICT (name) DO NOTHING`,
  );
  await query(
    `INSERT INTO translators (name) VALUES ('هاوار محەمەد'), ('ئاسۆ کەریم')
     ON CONFLICT (name) DO NOTHING`,
  );
  await query(
    `INSERT INTO suppliers (name, phone) VALUES
       ('دەزگای ئاراس', '0750-000-0001'),
       ('بڵاوکراوەی ڕەنج', '0770-000-0002'),
       ('دابینکەری کافتریا', '0751-000-0003')
     ON CONFLICT (name) DO NOTHING`,
  );

  const cat = {};
  for (const r of (await query('SELECT id, name FROM categories')).rows) cat[r.name] = r.id;
  const auth = {};
  for (const r of (await query('SELECT id, name FROM authors')).rows) auth[r.name] = r.id;
  const sup = {};
  for (const r of (await query('SELECT id, name FROM suppliers')).rows) sup[r.name] = r.id;

  const existing = await query('SELECT COUNT(*)::int AS n FROM products');
  if (existing.rows[0].n > 0) {
    console.log('Products already exist, skipping product/sale seed.');
    return;
  }

  let serial = 1;
  const books = [
    ['کتێبی ڕۆمانی یەکەم', cat['ڕۆمان'], auth['شێرکۆ بێکەس'], 5000, 8000, 40, 'purchased', 'sale'],
    ['مێژووی کوردستان', cat['مێژوو'], auth['عەبدوڵا گۆران'], 7000, 12000, 25, 'purchased', 'sale'],
    ['زانستی سروشت', cat['زانست'], auth['فرانتس کافکا'], 6000, 10000, 15, 'purchased', 'sale'],
    ['چیرۆکی منداڵان', cat['منداڵان'], auth['شێرکۆ بێکەس'], 0, 5000, 30, 'free', 'sale'],
    ['دیاری بەخشراو', cat['ڕۆمان'], auth['عەبدوڵا گۆران'], 0, 0, 20, 'free', 'gift'],
  ];
  const cafeteria = [
    ['قاوەی تورکی', cat['قاوە'], 750, 2000, 100],
    ['چای', cat['چای'], 250, 1000, 200],
    ['کێکی شکۆلاتە', cat['شیرینی'], 1500, 3500, 50],
    ['کۆلا', cat['خواردنەوەی سارد'], 500, 1500, 80],
  ];

  await withTransaction(async (client) => {
    const adminId = (await client.query("SELECT id FROM users WHERE username='admin'")).rows[0].id;

    for (const [name, categoryId, authorId, cost, sale, stock, acq, use] of books) {
      const { rows } = await client.query(
        `INSERT INTO products (type, name, barcode, category_id, cost_price, sale_price, stock_qty, acquisition, intended_use)
         VALUES ('book', $1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [name, code(serial++), categoryId, cost, sale, stock, acq, use],
      );
      await client.query(
        `INSERT INTO book_details (product_id, author_id, supplier_id, edition, publisher_place)
         VALUES ($1, $2, $3, 'چاپی یەکەم', 'هەولێر')`,
        [rows[0].id, authorId, sup['دەزگای ئاراس']],
      );
      await client.query(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, unit_cost, reference, created_by)
         VALUES ($1, $2, $3, $4, 'initial stock', $5)`,
        [rows[0].id, acq === 'free' ? 'free_in' : 'purchase', stock, cost, adminId],
      );
    }

    for (const [name, categoryId, cost, sale, stock] of cafeteria) {
      const { rows } = await client.query(
        `INSERT INTO products (type, name, barcode, category_id, cost_price, sale_price, stock_qty)
         VALUES ('cafeteria', $1, $2, $3, $4, $5, $6) RETURNING id`,
        [name, code(serial++), categoryId, cost, sale, stock],
      );
      await client.query(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, unit_cost, reference, created_by)
         VALUES ($1, 'purchase', $2, $3, 'initial stock', $4)`,
        [rows[0].id, stock, cost, adminId],
      );
    }

    // Discounts
    await client.query(
      `INSERT INTO discounts (name, scope, discount_type, value, is_active) VALUES
         ('داشکاندنی گشتی ١٠٪', 'global', 'percentage', 10, FALSE),
         ('داشکاندنی دڵسۆزی', 'loyalty', 'fixed', 1000, TRUE)`,
    );

    // A couple of sample sales across sections/channels
    const prods = (await client.query('SELECT id, name, type, cost_price, sale_price FROM products')).rows;
    const findBook = prods.find((p) => p.type === 'book' && p.sale_price > 0);
    const findCafe = prods.find((p) => p.type === 'cafeteria');

    const mkSale = async (invoice, channel, section, items) => {
      let subtotal = 0;
      let cost = 0;
      for (const it of items) {
        subtotal += Number(it.unit_price) * it.qty;
        cost += Number(it.unit_cost) * it.qty;
      }
      const { rows } = await client.query(
        `INSERT INTO sales (invoice_no, channel, section, cashier_id, subtotal, discount_total, total, cost_total, payment_method)
         VALUES ($1,$2,$3,$4,$5,0,$5,$6,'cash') RETURNING id`,
        [invoice, channel, section, adminId, subtotal, cost],
      );
      for (const it of items) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, product_name, product_type, quantity, unit_price, unit_cost, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [rows[0].id, it.id, it.name, it.type, it.qty, it.unit_price, it.unit_cost, it.unit_price * it.qty],
        );
        await client.query('UPDATE products SET stock_qty = stock_qty - $2 WHERE id = $1', [it.id, it.qty]);
      }
    };

    if (findBook) {
      await mkSale('INV-SEED-00001', 'store', 'library', [
        { id: findBook.id, name: findBook.name, type: 'book', qty: 2, unit_price: findBook.sale_price, unit_cost: findBook.cost_price },
      ]);
      await mkSale('INV-SEED-00002', 'website', 'library', [
        { id: findBook.id, name: findBook.name, type: 'book', qty: 1, unit_price: findBook.sale_price, unit_cost: findBook.cost_price },
      ]);
    }
    if (findCafe) {
      await mkSale('INV-SEED-00003', 'store', 'cafeteria', [
        { id: findCafe.id, name: findCafe.name, type: 'cafeteria', qty: 3, unit_price: findCafe.sale_price, unit_cost: findCafe.cost_price },
      ]);
    }

    // Expenses
    await client.query(
      `INSERT INTO expenses (category, description, amount, section, created_by) VALUES
         ('کرێ', 'کرێی مانگانە', 250000, 'general', $1),
         ('کارەبا', 'پسوولەی کارەبا', 50000, 'cafeteria', $1)`,
      [adminId],
    );
  });

  console.log('Seed complete. Login with admin/admin123 or cashier/cashier123');
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
