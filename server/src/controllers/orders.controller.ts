import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const ordersRouter = Router();

ordersRouter.get('/:orderId', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
});
