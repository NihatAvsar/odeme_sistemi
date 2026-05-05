import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const adminRouter = Router();

adminRouter.get('/tables', async (_req, res, next) => {
  try {
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

    res.json(table);
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
