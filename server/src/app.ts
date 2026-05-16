import cors from 'cors';
import express from 'express';
import { adminRouter } from './controllers/admin.controller.js';
import { menuRouter } from './controllers/menu.controller.js';
import { orderRequestsRouter } from './controllers/order-requests.controller.js';
import { paymentsRouter } from './controllers/payments.controller.js';
import { webhookRouter } from './controllers/webhook.controller.js';
import { ordersRouter } from './controllers/orders.controller.js';
import { tablesRouter } from './controllers/tables.controller.js';
import { kitchenRouter } from './controllers/kitchen.controller.js';
import { promotionsRouter } from './controllers/promotions.controller.js';
import { tableActionsRouter } from './controllers/table-actions.controller.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { requestLogger } from './lib/logger.js';
import { metricsMiddleware, renderMetrics } from './lib/metrics.js';
import { createRateLimit } from './middleware/rate-limit.js';
import { securityHeaders } from './middleware/security.js';
import { requireAdminAuth } from './middleware/admin-auth.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createReadinessHandler } from './lib/readiness.js';

const globalRateLimit = createRateLimit({ name: 'global', windowMs: 60_000, max: 300 });
const adminRateLimit = createRateLimit({ name: 'admin', windowMs: 60_000, max: 120 });
const paymentRateLimit = createRateLimit({ name: 'payments', windowMs: 60_000, max: 40 });
const webhookRateLimit = createRateLimit({ name: 'webhooks', windowMs: 60_000, max: 120 });
const orderRequestRateLimit = createRateLimit({ name: 'order_requests', windowMs: 60_000, max: 30 });
const tableActionRateLimit = createRateLimit({ name: 'table_actions', windowMs: 60_000, max: 30 });
const promotionRateLimit = createRateLimit({ name: 'promotions', windowMs: 60_000, max: 60 });

function corsOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
  if (!origin || env.corsOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('CORS origin not allowed'));
}

export function createApp() {
  const app = express();

  if (env.trustProxy) app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(requestLogger);
  app.use(metricsMiddleware);
  app.use(globalRateLimit);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/ready', createReadinessHandler(prisma));

  app.get('/metrics', env.isProduction ? requireAdminAuth : (_req, _res, next) => next(), (_req, res) => {
    res.type('text/plain').send(renderMetrics());
  });

  app.use('/api/payments', paymentRateLimit, paymentsRouter);
  app.use('/api/menu', menuRouter);
  app.use('/api/order-requests', orderRequestRateLimit, orderRequestsRouter);
  app.use('/api/tables', tablesRouter);
  app.use('/api/tables', tableActionRateLimit, tableActionsRouter);
  app.use('/api/admin', adminRateLimit, adminRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/admin/kitchen', kitchenRouter);
  app.use('/api/promotions', promotionRateLimit, promotionsRouter);
  app.use('/api/webhooks', webhookRateLimit, webhookRouter);

  app.use(createErrorHandler());

  return app;
}
