import type { BillItem, OrderTotals, SelectedItem } from '../types/billing';

export function calculateLineTotal(item: BillItem) {
  return item.unitPrice * item.quantity;
}

export function calculateOrderTotals(
  items: BillItem[],
  discount = 0,
  serviceFeeRate = 0.08,
  taxRate = 0,
): OrderTotals {
  const subtotal = items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  const serviceFee = subtotal * serviceFeeRate;
  const taxableBase = subtotal - discount + serviceFee;
  const tax = taxableBase * taxRate;
  const total = subtotal - discount + serviceFee + tax;

  return { subtotal, discount, serviceFee, tax, total };
}

export function calculateSelectedAmount(items: BillItem[], selected: SelectedItem[]) {
  const selectedMap = new Map(selected.map((item) => [item.id, item.quantity]));

  return items.reduce((sum, item) => {
    const qty = selectedMap.get(item.id) ?? 0;
    return sum + qty * item.unitPrice;
  }, 0);
}

export function splitRemainingAmount(total: number, peopleCount: number) {
  if (peopleCount <= 0) return [];

  const base = Math.floor((total / peopleCount) * 100) / 100;
  const values = Array.from({ length: peopleCount }, () => base);
  const diff = Number((total - base * peopleCount).toFixed(2));

  if (diff > 0) values[0] = Number((values[0] + diff).toFixed(2));

  return values;
}
