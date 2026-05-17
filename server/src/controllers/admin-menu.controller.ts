import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { realtimeGateway } from '../lib/realtime.js';
import { getAuditRequestContext, writeAuditLog } from '../lib/audit.js';

export const adminMenuRouter = Router();

adminMenuRouter.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.menuItem.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        restaurant: true,
        optionGroups: { orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } } } },
      },
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

adminMenuRouter.put('/:itemId/options', async (req, res, next) => {
  try {
    const { groups = [] } = req.body as {
      groups?: Array<{
        name?: string;
        type?: 'SINGLE' | 'MULTIPLE';
        isRequired?: boolean;
        minSelect?: number;
        maxSelect?: number;
        sortOrder?: number;
        isActive?: boolean;
        options?: Array<{
          name?: string;
          priceDelta?: number;
          isDefault?: boolean;
          isActive?: boolean;
          sortOrder?: number;
        }>;
      }>;
    };

    const item = await prisma.menuItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.menuOptionGroup.deleteMany({ where: { menuItemId: item.id } });

      for (const [groupIndex, group] of groups.entries()) {
        if (!group.name?.trim()) continue;
        await tx.menuOptionGroup.create({
          data: {
            restaurantId: item.restaurantId,
            menuItemId: item.id,
            name: group.name.trim(),
            type: group.type ?? 'SINGLE',
            isRequired: Boolean(group.isRequired),
            minSelect: Math.max(0, Math.floor(group.minSelect ?? 0)),
            maxSelect: Math.max(1, Math.floor(group.maxSelect ?? (group.type === 'MULTIPLE' ? 99 : 1))),
            sortOrder: group.sortOrder ?? groupIndex,
            isActive: group.isActive ?? true,
            options: {
              create: (group.options ?? [])
                .filter((option) => option.name?.trim())
                .map((option, optionIndex) => ({
                  name: option.name!.trim(),
                  priceDelta: Number(option.priceDelta ?? 0),
                  isDefault: Boolean(option.isDefault),
                  isActive: option.isActive ?? true,
                  sortOrder: option.sortOrder ?? optionIndex,
                })),
            },
          },
        });
      }
    });

    realtimeGateway.emitToRestaurant(item.restaurantId, 'menu.updated', { restaurantId: item.restaurantId });
    const updated = await prisma.menuItem.findUnique({
      where: { id: item.id },
      include: { optionGroups: { orderBy: { sortOrder: 'asc' }, include: { options: { orderBy: { sortOrder: 'asc' } } } } },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

adminMenuRouter.post('/', async (req, res, next) => {
  try {
    const { restaurantId, categoryId, name, description, imageUrl, price, currency = 'TRY', isActive = true, isOutOfStock = false, updatedBy } = req.body as {
      restaurantId?: string;
      categoryId?: string | null;
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
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
        imageUrl: imageUrl?.trim() || null,
        price: Number(price),
        currency,
        isActive,
        isOutOfStock,
        updatedBy,
      },
    });

    await writeAuditLog({
      restaurantId: resolvedRestaurantId,
      actorId: updatedBy,
      action: 'menu.create',
      entityType: 'MenuItem',
      entityId: item.id,
      payload: { new: item },
      ...getAuditRequestContext(req),
    });

    realtimeGateway.emitToRestaurant(resolvedRestaurantId, 'menu.updated', { restaurantId: resolvedRestaurantId });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

adminMenuRouter.patch('/:itemId', async (req, res, next) => {
  try {
    const { name, description, imageUrl, price, currency, categoryId, isActive, updatedBy } = req.body as {
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
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
        imageUrl: imageUrl === undefined ? undefined : imageUrl?.trim() || null,
        price,
        currency,
        categoryId: resolvedCategoryId,
        isActive,
        updatedBy,
      },
    });

    await writeAuditLog({
      restaurantId: item.restaurantId,
      actorId: updatedBy,
      action: 'menu.update',
      entityType: 'MenuItem',
      entityId: item.id,
      payload: { before: existing, after: item },
      ...getAuditRequestContext(req),
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

    await writeAuditLog({
      restaurantId: item.restaurantId,
      actorId: updatedBy,
      action: 'menu.stock',
      entityType: 'MenuItem',
      entityId: item.id,
      payload: { before: { isOutOfStock: existing.isOutOfStock }, after: { isOutOfStock: item.isOutOfStock } },
      ...getAuditRequestContext(req),
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

    const item = await prisma.menuItem.delete({
      where: { id: existing.id },
    });

    await writeAuditLog({
      restaurantId: item.restaurantId,
      actorId: updatedBy,
      action: 'menu.delete',
      entityType: 'MenuItem',
      entityId: item.id,
      payload: { before: existing, deletedBy: updatedBy },
      ...getAuditRequestContext(req),
    });

    realtimeGateway.emitToRestaurant(item.restaurantId, 'menu.updated', { restaurantId: item.restaurantId });

    res.json(item);
  } catch (error) {
    next(error);
  }
});
