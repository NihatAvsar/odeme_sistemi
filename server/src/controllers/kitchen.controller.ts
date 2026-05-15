import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { hasAdminAuth } from '../middleware/admin-auth.js';
import { realtimeGateway } from '../lib/realtime.js';
import { getAuditRequestContext, writeAuditLog } from '../lib/audit.js';
import { validate } from '../middleware/validate.js';
import { kitchenTicketUpdateBody, params } from '../schemas/api.js';

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

kitchenRouter.patch('/tickets/:orderItemId', validate({ params: params.orderItemId, body: kitchenTicketUpdateBody }), async (req, res, next) => {
  if (!hasAdminAuth(req, res)) return;
  try {
    const orderItemId = String(req.params.orderItemId);
    const { status } = req.body as { status?: 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED' };
    if (!status || !['NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'].includes(status)) {
      res.status(400).json({ message: 'Invalid kitchen status' });
      return;
    }

    const existing = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    }) as any;

    if (!existing) {
      res.status(404).json({ message: 'Order item not found' });
      return;
    }

    const item = await prisma.orderItem.update({
      where: { id: orderItemId },
      data: { kitchenStatus: status },
      include: { order: true },
    }) as any;

    await writeAuditLog({
      restaurantId: item.order.restaurantId,
      action: 'kitchen.ticket.update',
      entityType: 'OrderItem',
      entityId: item.id,
      payload: { before: { kitchenStatus: existing.kitchenStatus }, after: { kitchenStatus: status } },
      ...getAuditRequestContext(req),
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
