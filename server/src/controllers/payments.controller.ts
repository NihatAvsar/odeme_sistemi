import { Router } from 'express';
import { paymentService } from '../services/payment.service.js';

export const paymentsRouter = Router();

paymentsRouter.post('/initiate', async (req, res, next) => {
  try {
    const result = await paymentService.initiate(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/confirm', async (req, res, next) => {
  try {
    const result = await paymentService.confirm(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
