import type { OrderItem } from '@prisma/client';

export type PresentedOrderItem = {
  id: string;
  groupKey: string;
  menuItemId: string | null;
  nameSnapshot: string;
  unitPriceSnapshot: string | number;
  quantity: number;
  paidQuantity: number;
  status: string;
  kitchenStatus: string;
  lineTotal: string | number;
  notes: string | null;
};

function mergeKitchenStatus(current: string, next: string) {
  const priority = ['CANCELLED', 'NEW', 'PREPARING', 'READY', 'SERVED'];
  return priority.indexOf(next) < priority.indexOf(current) ? next : current;
}

export function groupOrderItems(items: OrderItem[]): PresentedOrderItem[] {
  const groups = new Map<string, PresentedOrderItem>();

  for (const item of items) {
    const key = [item.menuItemId ?? 'none', String(item.unitPriceSnapshot), item.notes ?? ''].join('|');
    const existing = groups.get(key);

    if (!existing) {
        groups.set(key, {
        id: key,
        groupKey: key,
        menuItemId: item.menuItemId,
        nameSnapshot: item.nameSnapshot,
        unitPriceSnapshot: Number(item.unitPriceSnapshot),
          quantity: item.quantity,
          paidQuantity: item.paidQuantity,
          status: item.status,
          kitchenStatus: item.kitchenStatus,
          lineTotal: Number(item.lineTotal),
          notes: item.notes,
        });
      continue;
    }

    const nextQuantity = existing.quantity + item.quantity;
      const nextPaidQuantity = existing.paidQuantity + item.paidQuantity;
      const nextLineTotal = Number(existing.lineTotal) + Number(item.lineTotal);
      const nextKitchenStatus = mergeKitchenStatus(existing.kitchenStatus, item.kitchenStatus);

      groups.set(key, {
        ...existing,
      id: key,
      groupKey: key,
        quantity: nextQuantity,
        paidQuantity: nextPaidQuantity,
        lineTotal: nextLineTotal,
        kitchenStatus: nextKitchenStatus,
        status: nextPaidQuantity >= nextQuantity ? 'PAID' : nextPaidQuantity > 0 ? 'PARTIALLY_PAID' : 'OPEN',
      });
  }

  return Array.from(groups.values());
}
