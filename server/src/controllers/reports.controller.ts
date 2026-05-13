import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const reportsRouter = Router();

function getDateRange(query: { from?: unknown; to?: unknown }) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const from = typeof query.from === 'string' && query.from ? new Date(query.from) : startOfToday;
  const to = typeof query.to === 'string' && query.to ? new Date(query.to) : endOfToday;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Invalid date range');
  }

  return { from, to };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function getSuccessfulPayments(from: Date, to: Date) {
  return prisma.payment.findMany({
    where: {
      status: 'SUCCESS',
      processedAt: { gte: from, lte: to },
    },
    orderBy: { processedAt: 'asc' },
    include: {
      order: {
        include: {
          session: { include: { table: true } },
        },
      },
    },
  });
}

reportsRouter.get('/summary', async (req, res, next) => {
  try {
    const { from, to } = getDateRange(req.query);
    const payments = await getSuccessfulPayments(from, to);
    const orderIds = [...new Set(payments.map((payment) => payment.orderId))];
    const orders = orderIds.length > 0
      ? await prisma.order.findMany({ where: { id: { in: orderIds } } })
      : [];

    const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const discountTotal = orders.reduce((sum, order) => sum + Number(order.discount), 0);
    const serviceFeeTotal = orders.reduce((sum, order) => sum + Number(order.serviceFee), 0);

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      totalRevenue,
      paymentCount: payments.length,
      orderCount: orderIds.length,
      averageCheck: orderIds.length > 0 ? totalRevenue / orderIds.length : 0,
      discountTotal,
      serviceFeeTotal,
    });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/daily-revenue', async (req, res, next) => {
  try {
    const { from, to } = getDateRange(req.query);
    const payments = await getSuccessfulPayments(from, to);
    const byDay = new Map<string, { date: string; totalRevenue: number; paymentCount: number }>();

    for (const payment of payments) {
      const date = dayKey(payment.processedAt ?? payment.createdAt);
      const current = byDay.get(date) ?? { date, totalRevenue: 0, paymentCount: 0 };
      current.totalRevenue += Number(payment.amount);
      current.paymentCount += 1;
      byDay.set(date, current);
    }

    res.json([...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/product-sales', async (req, res, next) => {
  try {
    const { from, to } = getDateRange(req.query);
    const payments = await getSuccessfulPayments(from, to);
    const orderIds = [...new Set(payments.map((payment) => payment.orderId))];

    if (orderIds.length === 0) {
      res.json([]);
      return;
    }

    const items = await prisma.orderItem.findMany({
      where: { orderId: { in: orderIds }, status: { not: 'CANCELLED' } },
      include: { menuItem: true },
    });

    const byProduct = new Map<string, { menuItemId: string | null; name: string; quantity: number; revenue: number }>();
    for (const item of items) {
      const key = item.menuItemId ?? item.nameSnapshot;
      const current = byProduct.get(key) ?? {
        menuItemId: item.menuItemId,
        name: item.menuItem?.name ?? item.nameSnapshot,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue += Number(item.lineTotal);
      byProduct.set(key, current);
    }

    res.json([...byProduct.values()].sort((a, b) => b.revenue - a.revenue));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/table-performance', async (req, res, next) => {
  try {
    const { from, to } = getDateRange(req.query);
    const payments = await getSuccessfulPayments(from, to);
    const byTable = new Map<string, { tableId: string; tableCode: string; tableName: string | null; sessionIds: Set<string>; revenue: number; paymentCount: number }>();

    for (const payment of payments) {
      const table = payment.order.session.table;
      const current = byTable.get(table.id) ?? {
        tableId: table.id,
        tableCode: table.code,
        tableName: table.name,
        sessionIds: new Set<string>(),
        revenue: 0,
        paymentCount: 0,
      };
      current.sessionIds.add(payment.order.sessionId);
      current.revenue += Number(payment.amount);
      current.paymentCount += 1;
      byTable.set(table.id, current);
    }

    res.json(
      [...byTable.values()]
        .map((table) => ({
          tableId: table.tableId,
          tableCode: table.tableCode,
          tableName: table.tableName,
          sessionCount: table.sessionIds.size,
          paymentCount: table.paymentCount,
          revenue: table.revenue,
          averageCheck: table.sessionIds.size > 0 ? table.revenue / table.sessionIds.size : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    );
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/payment-methods', async (req, res, next) => {
  try {
    const { from, to } = getDateRange(req.query);
    const payments = await getSuccessfulPayments(from, to);
    const byMethod = new Map<string, { provider: string; type: string; label: string; count: number; total: number }>();

    for (const payment of payments) {
      const key = `${payment.provider}:${payment.type}`;
      const current = byMethod.get(key) ?? {
        provider: payment.provider,
        type: payment.type,
        label: `${payment.provider} / ${payment.type}`,
        count: 0,
        total: 0,
      };
      current.count += 1;
      current.total += Number(payment.amount);
      byMethod.set(key, current);
    }

    res.json([...byMethod.values()].sort((a, b) => b.total - a.total));
  } catch (error) {
    next(error);
  }
});
