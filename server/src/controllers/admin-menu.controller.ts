import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { realtimeGateway } from '../lib/realtime.js';

export const adminMenuRouter = Router();

adminMenuRouter.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.menuItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: { category: true, restaurant: true },
    });

    res.json(items);
  } catch (error) {
    next(error);
  }
});

adminMenuRouter.get('/categories', async (_req, res, next) => {
  try {
    const categories = await prisma.menuCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { restaurant: true },
    });

    res.json(categories);
  } catch (error) {
    next(error);
  }
});

adminMenuRouter.post('/', async (req, res, next) => {
  try {
    const { restaurantId, categoryId, name, description, price, currency = 'TRY', isActive = true, isOutOfStock = false, updatedBy } = req.body as {
      restaurantId?: string;
      categoryId?: string | null;
      name?: string;
      description?: string | null;
      price?: number;
      currency?: string;
      isActive?: boolean;
      isOutOfStock?: boolean;
      updatedBy?: string;
    };

    if (!name || price === undefined || price === null || Number.isNaN(Number(price))) {
      res.status(400).json({ message: 'Invalid menu item payload' });
      return;
    }

    const resolvedRestaurantId =
      restaurantId ?? (await prisma.restaurant.findFirst({ orderBy: { createdAt: 'asc' } }))?.id;

    if (!resolvedRestaurantId) {
      res.status(400).json({ message: 'Restaurant not found' });
      return;
    }

    let resolvedCategoryId: string | null = null;
    if (categoryId && categoryId.trim().length > 0) {
      const category = await prisma.menuCategory.findFirst({
        where: {
          id: categoryId,
          restaurantId: resolvedRestaurantId,
        },
      });

      if (!category) {
        res.status(400).json({ message: 'Category not found for restaurant' });
        return;
      }

      resolvedCategoryId = category.id;
    }

    const item = await prisma.menuItem.create({
      data: {
        restaurantId: resolvedRestaurantId,
        categoryId: resolvedCategoryId,
        name,
        description,
        price: Number(price),
        currency,
        isActive,
        isOutOfStock,
        updatedBy,
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId: resolvedRestaurantId,
        actorId: updatedBy,
        action: 'menu.create',
        entityType: 'MenuItem',
        entityId: item.id,
        payload: item as never,
      },
    });

    realtimeGateway.emitToRestaurant(resolvedRestaurantId, 'menu.updated', { restaurantId: resolvedRestaurantId });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

adminMenuRouter.patch('/:itemId', async (req, res, next) => {
  try {
    const { name, description, price, currency, categoryId, isActive, updatedBy } = req.body as {
      name?: string;
      description?: string | null;
      price?: number;
      currency?: string;
      categoryId?: string | null;
      isActive?: boolean;
      updatedBy?: string;
    };

    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
    if (!existing) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    let resolvedCategoryId: string | null | undefined = categoryId;
    if (categoryId !== undefined) {
      if (categoryId === null || categoryId.trim().length === 0) {
        resolvedCategoryId = null;
      } else {
        const category = await prisma.menuCategory.findFirst({
          where: {
            id: categoryId,
            restaurantId: existing.restaurantId,
          },
        });

        if (!category) {
          res.status(400).json({ message: 'Category not found for restaurant' });
          return;
        }

        resolvedCategoryId = category.id;
      }
    }

    const item = await prisma.menuItem.update({
      where: { id: existing.id },
      data: {
        name,
        description,
        price,
        currency,
        categoryId: resolvedCategoryId,
        isActive,
        updatedBy,
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId: item.restaurantId,
        actorId: updatedBy,
        action: 'menu.update',
        entityType: 'MenuItem',
        entityId: item.id,
        payload: item as never,
      },
    });

    realtimeGateway.emitToRestaurant(item.restaurantId, 'menu.updated', { restaurantId: item.restaurantId });

    res.json(item);
  } catch (error) {
    next(error);
  }
});

adminMenuRouter.patch('/:itemId/stock', async (req, res, next) => {
  try {
    const { isOutOfStock, updatedBy } = req.body as { isOutOfStock?: boolean; updatedBy?: string };
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });

    if (!existing) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    const item = await prisma.menuItem.update({
      where: { id: existing.id },
      data: {
        isOutOfStock: Boolean(isOutOfStock),
        updatedBy,
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId: item.restaurantId,
        actorId: updatedBy,
        action: 'menu.stock',
        entityType: 'MenuItem',
        entityId: item.id,
        payload: { isOutOfStock: item.isOutOfStock } as never,
      },
    });

    realtimeGateway.emitToRestaurant(item.restaurantId, 'menu.updated', { restaurantId: item.restaurantId });

    res.json(item);
  } catch (error) {
    next(error);
  }
});

adminMenuRouter.delete('/:itemId', async (req, res, next) => {
  try {
    const { updatedBy } = req.body as { updatedBy?: string };
    const existing = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });

    if (!existing) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    const item = await prisma.menuItem.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        updatedBy,
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId: item.restaurantId,
        actorId: updatedBy,
        action: 'menu.delete',
        entityType: 'MenuItem',
        entityId: item.id,
        payload: { isActive: false } as never,
      },
    });

    realtimeGateway.emitToRestaurant(item.restaurantId, 'menu.updated', { restaurantId: item.restaurantId });

    res.json(item);
  } catch (error) {
    next(error);
  }
});
