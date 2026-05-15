import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { realtimeGateway } from '../lib/realtime.js';
import { hasAdminAuth } from '../middleware/admin-auth.js';
import { paymentService } from '../services/payment.service.js';
import { getAuditRequestContext, writeAuditLog } from '../lib/audit.js';
import { validate } from '../middleware/validate.js';
import { params, tableActionCreateBody, tableActionUpdateBody } from '../schemas/api.js';

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

tableActionsRouter.post('/:tableCode/actions', validate({ params: params.tableCode, body: tableActionCreateBody }), async (req, res, next) => {
  try {
    const tableCode = String(req.params.tableCode);
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
      where: { OR: [{ code: tableCode }, { id: tableCode }] },
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

    await writeAuditLog({
      restaurantId: table.restaurantId,
      action: 'table_action.create',
      entityType: 'TableAction',
      entityId: action.id,
      payload: { tableId: table.id, sessionId: session?.id, type, message: cleanMessage },
      ...getAuditRequestContext(req),
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

adminTableActionsRouter.patch('/:actionId', validate({ params: params.actionId, body: tableActionUpdateBody }), async (req, res, next) => {
  if (!hasAdminAuth(req, res)) return;

  try {
    const actionId = String(req.params.actionId);
    const { status, resolvedBy } = req.body as { status?: unknown; resolvedBy?: unknown };
    if (!isTableActionStatus(status)) {
      res.status(400).json({ message: 'Invalid table action status' });
      return;
    }

    const existingAction = await prisma.tableAction.findUnique({
      where: { id: actionId },
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
      where: { id: actionId },
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

    await writeAuditLog({
      restaurantId: action.restaurantId,
      actorId: typeof resolvedBy === 'string' ? resolvedBy : undefined,
      action: 'table_action.update',
      entityType: 'TableAction',
      entityId: action.id,
      payload: { before: { status: existingAction.status }, after: { status: action.status, resolvedAt: action.resolvedAt } },
      ...getAuditRequestContext(req),
    });

    if (existingAction.type === 'REQUEST_BILL' && status === 'RESOLVED') {
      try {
        await paymentService.cashSettleTable(existingAction.tableId, 'Hesap İsteği Çözüldü', getAuditRequestContext(req));
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
