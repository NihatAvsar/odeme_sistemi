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
import { env } from './config/env.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/payments', paymentsRouter);
  app.use('/api/menu', menuRouter);
  app.use('/api/order-requests', orderRequestsRouter);
  app.use('/api/tables', tablesRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/admin/kitchen', kitchenRouter);
  app.use('/api/promotions', promotionsRouter);
  app.use('/api/webhooks', webhookRouter);

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    res.status(400).json({ message });
  });

  return app;
}
