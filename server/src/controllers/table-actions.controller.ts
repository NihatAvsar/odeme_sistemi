import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { realtimeGateway } from '../lib/realtime.js';
import { hasAdminAuth } from '../middleware/admin-auth.js';
import { paymentService } from '../services/payment.service.js';

const actionTypes = ['CALL_WAITER', 'REQUEST_BILL', 'SEND_NOTE'] as const;
const actionStatuses = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'] as const;

type TableActionType = (typeof actionTypes)[number];
type TableActionStatus = (typeof actionStatuses)[number];

function isTableActionType(value: unknown): value is TableActionType {
  return typeof value === 'string' && actionTypes.includes(value as TableActionType);
}

function isTableActionStatus(value: unknown): value is TableActionStatus {
  return typeof value === 'string' && actionStatuses.includes(value as TableActionStatus);
}

export const tableActionsRouter = Router();
export const adminTableActionsRouter = Router();

tableActionsRouter.post('/:tableCode/actions', async (req, res, next) => {
  try {
    const { type, message } = req.body as { type?: unknown; message?: unknown };
    if (!isTableActionType(type)) {
      res.status(400).json({ message: 'Invalid table action type' });
      return;
    }

    const cleanMessage = typeof message === 'string' ? message.trim() : undefined;
    if (type === 'SEND_NOTE' && !cleanMessage) {
      res.status(400).json({ message: 'Not göndermek için mesaj gerekli' });
      return;
    }

    const table = await prisma.table.findFirst({
      where: { OR: [{ code: req.params.tableCode }, { id: req.params.tableCode }] },
      include: { restaurant: true },
    });

    if (!table) {
      res.status(404).json({ message: 'Table not found' });
      return;
    }

    const session = await prisma.tableSession.findFirst({
      where: { tableId: table.id, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });

    const existingOpen = await prisma.tableAction.findFirst({
      where: {
        tableId: table.id,
        type,
        status: 'OPEN',
      },
      orderBy: { createdAt: 'desc' },
      include: { table: true, session: true },
    });

    if (existingOpen) {
      res.status(409).json({ message: 'Bu istek zaten iletildi', action: existingOpen });
      return;
    }

    const action = await prisma.tableAction.create({
      data: {
        restaurantId: table.restaurantId,
        tableId: table.id,
        sessionId: session?.id,
        type,
        message: cleanMessage,
      },
      include: { table: true, session: true },
    });

    realtimeGateway.emitToRestaurant(table.restaurantId, 'table.action.created', {
      restaurantId: table.restaurantId,
      tableId: table.id,
      actionId: action.id,
      type,
    });

    realtimeGateway.emitToTable(table.id, 'table.action.created', {
      restaurantId: table.restaurantId,
      tableId: table.id,
      actionId: action.id,
      type,
    });

    res.status(201).json(action);
  } catch (error) {
    next(error);
  }
});

adminTableActionsRouter.get('/', async (req, res, next) => {
  if (!hasAdminAuth(req, res)) return;

  try {
    const status = req.query.status;
    const where = isTableActionStatus(status) ? { status } : {};
    const actions = await prisma.tableAction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        table: true,
        session: true,
      },
    });

    res.json(actions);
  } catch (error) {
    next(error);
  }
});

adminTableActionsRouter.patch('/:actionId', async (req, res, next) => {
  if (!hasAdminAuth(req, res)) return;

  try {
    const { status, resolvedBy } = req.body as { status?: unknown; resolvedBy?: unknown };
    if (!isTableActionStatus(status)) {
      res.status(400).json({ message: 'Invalid table action status' });
      return;
    }

    const existingAction = await prisma.tableAction.findUnique({
      where: { id: req.params.actionId },
      include: {
        table: true,
        session: true,
      },
    });

    if (!existingAction) {
      res.status(404).json({ message: 'Table action not found' });
      return;
    }

    const action = await prisma.tableAction.update({
      where: { id: req.params.actionId },
      data: {
        status,
        resolvedAt: status === 'RESOLVED' || status === 'CANCELLED' ? new Date() : null,
        resolvedBy: typeof resolvedBy === 'string' ? resolvedBy : undefined,
      },
      include: {
        table: true,
        session: true,
      },
    });

    if (existingAction.type === 'REQUEST_BILL' && status === 'RESOLVED') {
      try {
        await paymentService.cashSettleTable(existingAction.tableId, 'Hesap İsteği Çözüldü');
      } catch (settleError) {
        const message = settleError instanceof Error ? settleError.message : '';
        if (!message.includes('Open order not found') && !message.includes('Order already settled')) {
          throw settleError;
        }
      }
    }

    realtimeGateway.emitToRestaurant(action.restaurantId, 'table.action.updated', {
      restaurantId: action.restaurantId,
      tableId: action.tableId,
      actionId: action.id,
      status,
    });

    realtimeGateway.emitToTable(action.tableId, 'table.action.updated', {
      restaurantId: action.restaurantId,
      tableId: action.tableId,
      actionId: action.id,
      status,
    });

    res.json(action);
  } catch (error) {
    next(error);
  }
});
