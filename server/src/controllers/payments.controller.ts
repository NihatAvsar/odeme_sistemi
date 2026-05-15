import { Router } from 'express';
import { paymentService } from '../services/payment.service.js';
import { getAuditRequestContext } from '../lib/audit.js';
import { validate } from '../middleware/validate.js';
import { paymentConfirmBody, paymentInitiateBody } from '../schemas/api.js';

export const paymentsRouter = Router();

paymentsRouter.post('/initiate', validate({ body: paymentInitiateBody }), async (req, res, next) => {
  try {
    const result = await paymentService.initiate(req.body, getAuditRequestContext(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/confirm', validate({ body: paymentConfirmBody }), async (req, res, next) => {
  try {
    const result = await paymentService.confirm(req.body, getAuditRequestContext(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});
