import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { hasAdminAuth } from '../middleware/admin-auth.js';
import { realtimeGateway } from '../lib/realtime.js';

type RequestedItem = {
  menuItemId: string;
  quantity: number;
};

export const orderRequestsRouter = Router();

orderRequestsRouter.post('/', async (req, res, next) => {
  try {
    const { tableId, requestedBy, note, items } = req.body as {
      tableId?: string;
      requestedBy?: string;
      note?: string;
      items?: RequestedItem[];
    };

    if (!tableId || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'Invalid order request payload' });
      return;
    }

    const table = await prisma.table.findFirst({
      where: {
        OR: [{ id: tableId }, { code: tableId }],
      },
      include: {
        restaurant: true,
        sessions: {
          where: { status: 'OPEN' },
          take: 1,
          orderBy: { openedAt: 'desc' },
        },
      },
    });

    if (!table || table.sessions.length === 0) {
      res.status(404).json({ message: 'Open table session not found' });
      return;
    }

    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: items.map((item) => item.menuItemId) },
        restaurantId: table.restaurantId,
      },
    });

    const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));
    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem || !menuItem.isActive || menuItem.isOutOfStock) {
        res.status(400).json({ message: `Menu item unavailable: ${item.menuItemId}` });
        return;
      }
    }

    const orderRequest = await prisma.orderRequest.create({
      data: {
        restaurantId: table.restaurantId,
        tableSessionId: table.sessions[0].id,
        requestedBy,
        note,
        items,
      },
    });

    realtimeGateway.emitToTable(table.id, 'table.updated', {
      tableId: table.id,
      status: 'PENDING_APPROVAL',
    });
    realtimeGateway.emitToTable(table.id, 'order-request.created', {
      tableId: table.id,
      orderRequestId: orderRequest.id,
    });
    // Admin paneli de dinleyebilsin
    realtimeGateway.emitToRestaurant(table.restaurantId, 'order-request.created', {
      tableId: table.id,
      orderRequestId: orderRequest.id,
    });

    res.status(201).json(orderRequest);
  } catch (error) {
    next(error);
  }
});

orderRequestsRouter.get('/', async (req, res, next) => {
  if (!hasAdminAuth(req, res)) return;
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING_APPROVAL';

    const requests = await prisma.orderRequest.findMany({
      where: { status: status as any },
      orderBy: { createdAt: 'desc' },
      include: {
        tableSession: {
          include: { table: true },
        },
      },
    });

    res.json(requests);
  } catch (error) {
    next(error);
  }
});

orderRequestsRouter.post('/:id/approve', async (req, res, next) => {
  if (!hasAdminAuth(req, res)) return;
  try {
    const { adminName } = req.body as { adminName?: string };
    const request = await prisma.orderRequest.findUnique({
      where: { id: req.params.id },
      include: {
        tableSession: { include: { table: true } },
      },
    });

    if (!request) {
      res.status(404).json({ message: 'Order request not found' });
      return;
    }

    if (request.status !== 'PENDING_APPROVAL') {
      res.status(400).json({ message: 'Order request is not pending' });
      return;
    }

    const parsedItems = Array.isArray(request.items) ? request.items : [];

    const approvedOrder = await prisma.$transaction(async (tx) => {
      let order = await tx.order.findFirst({
        where: {
          sessionId: request.tableSessionId,
          status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        },
        include: { items: true },
      });

      if (!order) {
        order = await tx.order.create({
          data: {
            restaurantId: request.restaurantId,
            sessionId: request.tableSessionId,
            status: 'OPEN',
            subtotal: 0,
            total: 0,
            remaining: 0,
            paidTotal: 0,
          },
          include: { items: true },
        });
      }

      for (const item of parsedItems as RequestedItem[]) {
        const menuItem = await tx.menuItem.findUnique({ where: { id: item.menuItemId } });
        if (!menuItem) continue;

        const quantity = Math.max(1, Math.floor(item.quantity));
        const existingLine = await tx.orderItem.findFirst({
          where: {
            orderId: order.id,
            menuItemId: menuItem.id,
            unitPriceSnapshot: menuItem.price,
            notes: null,
          },
        });

        if (existingLine) {
          const nextQuantity = existingLine.quantity + quantity;
          const nextLineTotal = Number(existingLine.lineTotal) + Number(menuItem.price) * quantity;
          const nextPaidQuantity = Math.min(existingLine.paidQuantity, nextQuantity);

          await tx.orderItem.update({
            where: { id: existingLine.id },
            data: {
              quantity: nextQuantity,
              lineTotal: nextLineTotal,
              paidQuantity: nextPaidQuantity,
              status: nextPaidQuantity >= nextQuantity ? 'PAID' : nextPaidQuantity > 0 ? 'PARTIALLY_PAID' : 'OPEN',
              version: { increment: 1 },
            },
          });
        } else {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              menuItemId: menuItem.id,
              nameSnapshot: menuItem.name,
              unitPriceSnapshot: menuItem.price,
              quantity,
              lineTotal: Number(menuItem.price) * quantity,
            },
          });
        }
      }

      const updatedItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const subtotal = updatedItems.reduce((sum, item) => sum + Number(item.lineTotal), 0);
      const serviceFee = subtotal * 0.08;
      const total = subtotal + serviceFee;

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal,
          serviceFee,
          total,
          remaining: total,
          status: 'OPEN',
          version: { increment: 1 },
        },
        include: { items: true },
      });

      await tx.orderRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          orderId: order.id,
          approvedBy: adminName,
        },
      });

      return updatedOrder;
    });

    realtimeGateway.emitToTable(request.tableSession.table.id, 'order.updated', {
      orderId: approvedOrder.id,
      tableId: request.tableSession.table.id,
    });
    realtimeGateway.emitToTable(request.tableSession.table.id, 'order-request.updated', {
      tableId: request.tableSession.table.id,
      orderRequestId: request.id,
      status: 'APPROVED',
    });
    realtimeGateway.emitToRestaurant(request.restaurantId, 'order-request.updated', {
      tableId: request.tableSession.table.id,
      orderRequestId: request.id,
      status: 'APPROVED',
    });

    res.json(approvedOrder);
  } catch (error) {
    next(error);
  }
});

orderRequestsRouter.post('/:id/reject', async (req, res, next) => {
  if (!hasAdminAuth(req, res)) return;
  try {
    const { adminName, reason } = req.body as { adminName?: string; reason?: string };
    const request = await prisma.orderRequest.findUnique({
      where: { id: req.params.id },
      include: { tableSession: { include: { table: true } } },
    });

    if (!request) {
      res.status(404).json({ message: 'Order request not found' });
      return;
    }

    const updated = await prisma.orderRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        rejectedBy: adminName,
        rejectedReason: reason,
      },
    });

    realtimeGateway.emitToTable(request.tableSession.table.id, 'order-request.updated', {
      tableId: request.tableSession.table.id,
      orderRequestId: request.id,
      status: 'REJECTED',
    });
    realtimeGateway.emitToRestaurant(request.restaurantId, 'order-request.updated', {
      tableId: request.tableSession.table.id,
      orderRequestId: request.id,
      status: 'REJECTED',
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});
