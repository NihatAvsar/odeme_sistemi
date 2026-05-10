import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { hasAdminAuth } from '../middleware/admin-auth.js';
import { realtimeGateway } from '../lib/realtime.js';

export const kitchenRouter = Router();

kitchenRouter.get('/tickets', async (req, res, next) => {
  if (!hasAdminAuth(req, res)) return;
  try {
    const tickets = await prisma.orderItem.findMany({
      where: { kitchenStatus: { notIn: ['SERVED', 'CANCELLED'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        order: {
          include: {
            session: { include: { table: true } },
          },
        },
      },
    });

    res.json(tickets);
  } catch (error) {
    next(error);
  }
});

kitchenRouter.patch('/tickets/:orderItemId', async (req, res, next) => {
  if (!hasAdminAuth(req, res)) return;
  try {
    const { status } = req.body as { status?: 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED' };
    if (!status || !['NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'].includes(status)) {
      res.status(400).json({ message: 'Invalid kitchen status' });
      return;
    }

    const item = await prisma.orderItem.update({
      where: { id: req.params.orderItemId },
      data: { kitchenStatus: status },
      include: { order: true },
    });

    realtimeGateway.emitToRestaurant(item.order.restaurantId, 'kitchen.ticket.updated', {
      restaurantId: item.order.restaurantId,
      orderItemId: item.id,
      status,
    });

    res.json(item);
  } catch (error) {
    next(error);
  }
});
