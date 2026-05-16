import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { hasAdminAuth } from '../middleware/admin-auth.js';
import { realtimeGateway } from '../lib/realtime.js';
import { getAuditRequestContext, writeAuditLog } from '../lib/audit.js';
import { incrementMetric } from '../lib/metrics.js';
import { validate } from '../middleware/validate.js';
import { orderRequestApproveBody, orderRequestCreateBody, orderRequestRejectBody, params } from '../schemas/api.js';

type RequestedItem = {
  menuItemId: string;
  quantity: number;
  optionIds?: string[];
};

async function getServiceFee(restaurantId: string, subtotal: number) {
  const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } });
  if (!settings?.isServiceFeeEnabled) return 0;
  const value = Number(settings.serviceFeeValue);
  return settings.serviceFeeType === 'FIXED' ? value : subtotal * (value / 100);
}

async function getDiscount(restaurantId: string, subtotal: number, couponCode?: string | null) {
  if (!couponCode?.trim()) return 0;
  const now = new Date();
  const promotion = await prisma.promotion.findFirst({
    where: {
      restaurantId,
      code: couponCode.trim().toUpperCase(),
      isActive: true,
      minOrderAmount: { lte: subtotal },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
  });
  if (!promotion) return 0;
  if (promotion.usageLimit !== null && promotion.usedCount >= promotion.usageLimit) return 0;
  const value = Number(promotion.discountValue);
  return Math.min(subtotal, promotion.discountType === 'FIXED' ? value : subtotal * (value / 100));
}

export const orderRequestsRouter = Router();

orderRequestsRouter.post('/', validate({ body: orderRequestCreateBody }), async (req, res, next) => {
  try {
    const { tableId, requestedBy, note, couponCode, items } = req.body as {
      tableId?: string;
      requestedBy?: string;
      note?: string;
      couponCode?: string;
      items?: RequestedItem[];
    };

    if (!tableId || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'Invalid order request payload' });
      return;
    }

    const table = await prisma.table.findFirst({
      where: {
        OR: [{ id: tableId }, { code: tableId }, { qrToken: tableId }],
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
        couponCode: couponCode?.trim().toUpperCase() || null,
        items,
      },
    });

    await writeAuditLog({
      restaurantId: table.restaurantId,
      actorId: requestedBy,
      action: 'order_request.create',
      entityType: 'OrderRequest',
      entityId: orderRequest.id,
      payload: { tableId: table.id, sessionId: table.sessions[0].id, items, couponCode: orderRequest.couponCode },
      ...getAuditRequestContext(req),
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

orderRequestsRouter.post('/:id/approve', validate({ params: params.orderRequestId, body: orderRequestApproveBody }), async (req, res, next) => {
  if (!hasAdminAuth(req, res)) return;
  try {
    const requestId = String(req.params.id);
    const { adminName } = req.body as { adminName?: string };
    const request = await prisma.orderRequest.findUnique({
      where: { id: requestId },
      include: {
        tableSession: { include: { table: true } },
      },
    }) as any;

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
        const menuItem = await tx.menuItem.findUnique({
          where: { id: item.menuItemId },
          include: {
            optionGroups: {
              where: { isActive: true },
              include: { options: { where: { isActive: true } } },
            },
          },
        });
        if (!menuItem) continue;

        const quantity = Math.max(1, Math.floor(item.quantity));
        const selectedOptionIds = new Set(item.optionIds ?? []);
        const selectedOptions = menuItem.optionGroups.flatMap((group) => {
          const options = group.options.filter((option) => selectedOptionIds.has(option.id));
          if (group.isRequired && options.length < group.minSelect) {
            throw new Error(`Required option missing: ${group.name}`);
          }
          if (options.length > group.maxSelect) {
            throw new Error(`Too many options selected: ${group.name}`);
          }
          if (group.type === 'SINGLE' && options.length > 1) {
            throw new Error(`Only one option can be selected: ${group.name}`);
          }
          return options.map((option) => ({ group: group.name, name: option.name, priceDelta: Number(option.priceDelta) }));
        });
        const optionTotal = selectedOptions.reduce((sum, option) => sum + option.priceDelta, 0);
        const unitPrice = Number(menuItem.price) + optionTotal;
        const optionNotes = selectedOptions.length > 0 ? selectedOptions.map((option) => `${option.group}: ${option.name}`).join(', ') : null;
        const existingLine = await tx.orderItem.findFirst({
          where: {
            orderId: order.id,
            menuItemId: menuItem.id,
            unitPriceSnapshot: unitPrice,
            notes: optionNotes,
          },
        });

        if (existingLine) {
          const nextQuantity = existingLine.quantity + quantity;
          const nextLineTotal = Number(existingLine.lineTotal) + unitPrice * quantity;
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
              nameSnapshot: selectedOptions.length > 0 ? `${menuItem.name} (${selectedOptions.map((option) => option.name).join(', ')})` : menuItem.name,
              unitPriceSnapshot: unitPrice,
              quantity,
              lineTotal: unitPrice * quantity,
              notes: optionNotes,
              selectedOptions: selectedOptions as never,
            },
          });
        }
      }

      const updatedItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const subtotal = updatedItems.reduce((sum, item) => sum + Number(item.lineTotal), 0);
      const discount = await getDiscount(request.restaurantId, subtotal, request.couponCode);
      const serviceFee = await getServiceFee(request.restaurantId, subtotal);
      const total = Math.max(0, subtotal + serviceFee - discount);

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal,
          discount,
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
    realtimeGateway.emitToRestaurant(request.restaurantId, 'kitchen.ticket.created', {
      restaurantId: request.restaurantId,
      orderId: approvedOrder.id,
    });
    incrementMetric('order_request_events_total', { action: 'approve' });

    await writeAuditLog({
      restaurantId: request.restaurantId,
      actorId: adminName,
      action: 'order_request.approve',
      entityType: 'OrderRequest',
      entityId: request.id,
      payload: { orderId: approvedOrder.id, tableId: request.tableSession.table.id, status: 'APPROVED' },
      ...getAuditRequestContext(req),
    });

    res.json(approvedOrder);
  } catch (error) {
    next(error);
  }
});

orderRequestsRouter.post('/:id/reject', validate({ params: params.orderRequestId, body: orderRequestRejectBody }), async (req, res, next) => {
  if (!hasAdminAuth(req, res)) return;
  try {
    const requestId = String(req.params.id);
    const { adminName, reason } = req.body as { adminName?: string; reason?: string };
    const request = await prisma.orderRequest.findUnique({
      where: { id: requestId },
      include: { tableSession: { include: { table: true } } },
    }) as any;

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
    incrementMetric('order_request_events_total', { action: 'reject' });

    await writeAuditLog({
      restaurantId: request.restaurantId,
      actorId: adminName,
      action: 'order_request.reject',
      entityType: 'OrderRequest',
      entityId: request.id,
      payload: { tableId: request.tableSession.table.id, status: 'REJECTED', reason },
      ...getAuditRequestContext(req),
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});
