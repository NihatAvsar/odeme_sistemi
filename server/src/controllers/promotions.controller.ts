import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { promotionValidateBody } from '../schemas/api.js';

export const promotionsRouter = Router();

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

promotionsRouter.post('/validate', validate({ body: promotionValidateBody }), async (req, res, next) => {
  try {
    const { tableCode, subtotal, couponCode } = req.body as { tableCode?: string; subtotal?: number; couponCode?: string };
    if (!tableCode || !couponCode) {
      res.status(400).json({ valid: false, reason: 'Kupon kodu girin.' });
      return;
    }

    const table = await prisma.table.findFirst({
      where: { OR: [{ code: tableCode }, { id: tableCode }] },
      select: { restaurantId: true },
    });
    if (!table) {
      res.status(404).json({ valid: false, reason: 'Masa bulunamadı.' });
      return;
    }

    const promo = await prisma.promotion.findFirst({
      where: {
        restaurantId: table.restaurantId,
        code: normalizeCode(couponCode),
      },
    });

    if (!promo) {
      res.json({ valid: false, reason: 'Kupon bulunamadı.', discount: 0 });
      return;
    }
    if (!promo.isActive) {
      res.json({ valid: false, reason: 'Kupon aktif değil.', discount: 0 });
      return;
    }

    const now = new Date();
    if (promo.startsAt && promo.startsAt > now) {
      res.json({ valid: false, reason: 'Kupon henüz başlamadı.', discount: 0 });
      return;
    }
    if (promo.endsAt && promo.endsAt < now) {
      res.json({ valid: false, reason: 'Kupon süresi doldu.', discount: 0 });
      return;
    }

    const subtotalValue = Number(subtotal ?? 0);
    if (subtotalValue < Number(promo.minOrderAmount)) {
      res.json({ valid: false, reason: 'Minimum tutar sağlanmıyor.', discount: 0 });
      return;
    }
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      res.json({ valid: false, reason: 'Kupon kullanım limiti doldu.', discount: 0 });
      return;
    }

    const value = Number(promo.discountValue);
    const discount = Math.min(subtotalValue, promo.discountType === 'FIXED' ? value : subtotalValue * (value / 100));
    res.json({ valid: true, reason: null, discount, code: promo.code, discountType: promo.discountType });
  } catch (error) {
    next(error);
  }
});
