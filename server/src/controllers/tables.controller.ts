import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { groupOrderItems } from '../lib/order-presenter.js';
import { releaseTableIfDue } from '../services/table-release.service.js';

export const tablesRouter = Router();

tablesRouter.get('/:tableCode', async (req, res, next) => {
  try {
    const table = await prisma.table.findFirst({
      where: {
        OR: [{ code: req.params.tableCode }, { id: req.params.tableCode }],
      },
      include: { restaurant: true },
    });

    if (!table) {
      res.status(404).json({ message: 'Table not found' });
      return;
    }

    if (table.status === 'CLEANING' && table.releaseAt) {
      if (table.releaseAt > new Date()) {
        res.status(423).json({
          message: 'Ödeme alındı, masa 3 dakika içinde boşalacak.',
        });
        return;
      }

      await releaseTableIfDue(table.id);
    }

    if (table.status === 'RESERVED') {
      res.status(423).json({ message: 'Bu masa şu anda rezerve.' });
      return;
    }

    const session = await prisma.tableSession.findFirst({
      where: {
        tableId: table.id,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
      include: {
        orders: {
          where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
          take: 1,
          include: { items: true },
        },
      },
    });

    const activeSession =
      session ??
      (await prisma.tableSession.create({
        data: {
          restaurantId: table.restaurantId,
          tableId: table.id,
          status: 'OPEN',
        },
        include: {
          orders: {
            where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
            take: 1,
            include: { items: true },
          },
        },
      }));

    const activeOrder = activeSession?.orders[0] ?? null;

    res.json({
      table,
      session: activeSession,
        activeOrder: activeOrder
        ? {
            ...activeOrder,
            discount: Number(activeOrder.discount),
            serviceFee: Number(activeOrder.serviceFee),
            total: Number(activeOrder.total),
            remaining: Number(activeOrder.remaining),
            items: groupOrderItems(activeOrder.items),
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});
