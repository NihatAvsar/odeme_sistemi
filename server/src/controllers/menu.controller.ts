import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const menuRouter = Router();

menuRouter.get('/:tableCode', async (req, res, next) => {
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
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            imageUrl: true,
            isActive: true,
            isOutOfStock: true,
          },
        },
      },
    });

    res.json({ table, categories });
  } catch (error) {
    next(error);
  }
});
