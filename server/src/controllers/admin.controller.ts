import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAdminAuth } from '../middleware/admin-auth.js';
import { adminMenuRouter } from './admin-menu.controller.js';
import { groupOrderItems } from '../lib/order-presenter.js';
import { paymentService } from '../services/payment.service.js';
import { releaseDueTables } from '../services/table-release.service.js';
import { reportsRouter } from './reports.controller.js';
import { adminTableActionsRouter } from './table-actions.controller.js';

export const adminRouter = Router();

adminRouter.use(requireAdminAuth);

adminRouter.use('/menu', adminMenuRouter);
adminRouter.use('/reports', reportsRouter);
adminRouter.use('/table-actions', adminTableActionsRouter);

adminRouter.post('/tables', async (req, res, next) => {
  try {
    const { restaurantId, count = 1, namePrefix = 'Masa', capacity = 4, startCode } = req.body as {
      restaurantId?: string;
      count?: number;
      namePrefix?: string;
      capacity?: number;
      startCode?: number;
    };

    const resolvedRestaurantId = restaurantId ?? (await prisma.restaurant.findFirst({ orderBy: { createdAt: 'asc' } }))?.id;
    if (!resolvedRestaurantId) {
      res.status(400).json({ message: 'Restaurant not found' });
      return;
    }

    const existingTables = await prisma.table.findMany({
      where: { restaurantId: resolvedRestaurantId },
      select: { code: true },
      orderBy: { code: 'asc' },
    });

    const usedCodes = new Set(existingTables.map((table) => table.code));
    const tables = [] as Array<{ id: string; code: string; name: string | null; qrToken: string }>;
    const lastExistingCode = existingTables[existingTables.length - 1]?.code ?? '0';
    let candidate = Math.max(1, Math.floor(startCode ?? (Number(lastExistingCode.replace(/\D/g, '')) || 0) + 1));

    while (tables.length < Math.max(1, Math.floor(count))) {
      while (usedCodes.has(String(candidate))) {
        candidate += 1;
      }

      const code = String(candidate);
      usedCodes.add(code);

      const table = await prisma.table.create({
        data: {
          restaurantId: resolvedRestaurantId,
          code,
          name: `${namePrefix} ${code}`,
          qrToken: `qr-${resolvedRestaurantId}-${code}-${Date.now()}-${tables.length + 1}`,
          status: 'AVAILABLE',
          capacity,
        },
      });

      tables.push({ id: table.id, code: table.code, name: table.name, qrToken: table.qrToken });
      candidate += 1;
    }

    res.status(201).json({ tables });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      res.status(409).json({ message: 'Bu masa kodu zaten kullaniliyor. Lutfen farkli bir baslangic kodu deneyin.' });
      return;
    }
    next(error);
  }
});

adminRouter.post('/tables/:tableId/cash-settle', async (req, res, next) => {
  try {
    const result = await paymentService.cashSettleTable(req.params.tableId, 'Kasada Ödendi');
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/tables', async (_req, res, next) => {
  try {
    await releaseDueTables();

    const tables = await prisma.table.findMany({
      include: {
        sessions: {
          where: { status: 'OPEN' },
          take: 1,
          orderBy: { openedAt: 'desc' },
          include: {
            orders: {
              where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
              take: 1,
              include: { items: true },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    res.json(tables);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/tables/:tableId', async (req, res, next) => {
  try {
    await releaseDueTables();

    const table = await prisma.table.findUnique({
      where: { id: req.params.tableId },
      include: {
        sessions: {
          where: { status: 'OPEN' },
          take: 1,
          orderBy: { openedAt: 'desc' },
          include: {
            orders: {
              where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
              take: 1,
              include: { items: true },
            },
            requests: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
      },
    });

    if (!table) {
      res.status(404).json({ message: 'Table not found' });
      return;
    }

    const activeOrder = table.sessions[0]?.orders[0];
    res.json({
      ...table,
      sessions: table.sessions.map((session) => ({
        ...session,
        orders: session.orders.map((order) => ({
          ...order,
          items: groupOrderItems(order.items),
        })),
      })),
      activeOrder: activeOrder
        ? {
            ...activeOrder,
            items: groupOrderItems(activeOrder.items),
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/pending-orders', async (_req, res, next) => {
  try {
    const pending = await prisma.orderRequest.findMany({
      where: { status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'desc' },
      include: {
        tableSession: { include: { table: true } },
      },
    });

    res.json(pending);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/settings', async (_req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!restaurant) {
      res.status(404).json({ message: 'Restaurant not found' });
      return;
    }

    const settings = await prisma.restaurantSettings.upsert({
      where: { restaurantId: restaurant.id },
      create: { restaurantId: restaurant.id },
      update: {},
    });

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/settings', async (req, res, next) => {
  try {
    const { serviceFeeType, serviceFeeValue, isServiceFeeEnabled } = req.body as {
      serviceFeeType?: 'PERCENT' | 'FIXED';
      serviceFeeValue?: number;
      isServiceFeeEnabled?: boolean;
    };
    const restaurant = await prisma.restaurant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!restaurant) {
      res.status(404).json({ message: 'Restaurant not found' });
      return;
    }

    const settings = await prisma.restaurantSettings.upsert({
      where: { restaurantId: restaurant.id },
      create: {
        restaurantId: restaurant.id,
        serviceFeeType: serviceFeeType ?? 'PERCENT',
        serviceFeeValue: serviceFeeValue ?? 8,
        isServiceFeeEnabled: isServiceFeeEnabled ?? true,
      },
      update: {
        ...(serviceFeeType ? { serviceFeeType } : {}),
        ...(serviceFeeValue !== undefined ? { serviceFeeValue } : {}),
        ...(isServiceFeeEnabled !== undefined ? { isServiceFeeEnabled } : {}),
      },
    });

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/promotions', async (_req, res, next) => {
  try {
    const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(promotions);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/promotions', async (req, res, next) => {
  try {
    const { name, code, discountType = 'PERCENT', discountValue, minOrderAmount = 0, startsAt, endsAt, usageLimit, isActive = true } = req.body as {
      name?: string;
      code?: string;
      discountType?: 'PERCENT' | 'FIXED';
      discountValue?: number;
      minOrderAmount?: number;
      startsAt?: string;
      endsAt?: string;
      usageLimit?: number;
      isActive?: boolean;
    };
    const restaurant = await prisma.restaurant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!restaurant || !name || discountValue === undefined) {
      res.status(400).json({ message: 'Invalid promotion payload' });
      return;
    }

    const promotion = await prisma.promotion.create({
      data: {
        restaurantId: restaurant.id,
        name,
        code: code?.trim().toUpperCase() || null,
        discountType,
        discountValue,
        minOrderAmount,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        usageLimit,
        isActive,
      },
    });

    res.status(201).json(promotion);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/promotions/:promotionId', async (req, res, next) => {
  try {
    const promotion = await prisma.promotion.update({
      where: { id: req.params.promotionId },
      data: req.body,
    });
    res.json(promotion);
  } catch (error) {
    next(error);
  }
});
