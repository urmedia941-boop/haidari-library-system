import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

import authRoutes from './routes/auth.js';
import referenceRoutes from './routes/reference.js';
import productRoutes from './routes/products.js';
import discountRoutes from './routes/discounts.js';
import salesRoutes from './routes/sales.js';
import purchaseRoutes from './routes/purchases.js';
import expenseRoutes from './routes/expenses.js';
import inventoryRoutes from './routes/inventory.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import backupRoutes from './routes/backup.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  if (config.nodeEnv !== 'test') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/reference', referenceRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/discounts', discountRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/purchases', purchaseRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/backups', backupRoutes);

  app.use('/api', notFoundHandler);

  // Serve the built frontend (if present) so the whole app can run from a
  // single origin in production-style deployments.
  const clientDist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../client/dist',
  );
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);

  return app;
}
