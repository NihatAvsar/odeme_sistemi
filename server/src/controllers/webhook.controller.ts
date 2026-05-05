import { Router } from 'express';

export const webhookRouter = Router();

webhookRouter.post('/mock-payment', async (_req, res) => {
  res.json({ ok: true });
});
