import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { releaseTableIfDue } from '../services/table-release.service.js';

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

    if (table.status === 'CLEANING' && table.releaseAt) {
      if (table.releaseAt > new Date()) {
        res.status(423).json({
          message: 'Ödeme alındı, masa 3 dakika içinde boşalacak.',
        });
        return;
      }

      await releaseTableIfDue(table.id);
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
            optionGroups: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                options: {
                  where: { isActive: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    res.json({ table, categories });
  } catch (error) {
    next(error);
  }
});
