import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
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
  app.use(errorHandler);

  return app;
}
