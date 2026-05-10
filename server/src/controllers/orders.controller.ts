import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { groupOrderItems } from '../lib/order-presenter.js';

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

    res.json({
      ...order,
      discount: Number(order.discount),
      serviceFee: Number(order.serviceFee),
      total: Number(order.total),
      remaining: Number(order.remaining),
      items: groupOrderItems(order.items),
    });
  } catch (error) {
    next(error);
  }
});
