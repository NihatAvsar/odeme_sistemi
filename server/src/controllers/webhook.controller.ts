import { Router } from 'express';
import { paymentService } from '../services/payment.service.js';
import { env } from '../config/env.js';

export const webhookRouter = Router();

function isValidIyzicoToken(token: string) {
  return /^[A-Za-z0-9_-]{8,256}$/.test(token);
}

webhookRouter.post('/mock-payment', async (_req, res) => {
  res.json({ ok: true });
});

webhookRouter.post('/iyzico/callback', async (req, res, next) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token : typeof req.query.token === 'string' ? req.query.token : '';
    if (!token || !isValidIyzicoToken(token)) {
      res.status(400).json({ message: 'Iyzico token missing' });
      return;
    }

    const result = await paymentService.confirmProviderCallback('iyzico', token);
    const frontendBaseUrl = env.corsOrigins[0] ?? 'http://localhost:5173';
    res.redirect(303, `${frontendBaseUrl}/checkout/success?tableId=${encodeURIComponent(result.tableId)}`);
  } catch (error) {
    next(error);
  }
});
