import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const menuRouter = Router();

menuRouter.get('/:tableId', async (req, res, next) => {
  try {
    const table = await prisma.table.findUnique({
      where: { id: req.params.tableId },
      include: { restaurant: true },
    });

    if (!table) {
      res.status(404).json({ message: 'Table not found' });
      return;
    }

    const categories = await prisma.menuCategory.findMany({
      where: {
        restaurantId: table.restaurantId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json({ table, categories });
  } catch (error) {
    next(error);
  }
});
