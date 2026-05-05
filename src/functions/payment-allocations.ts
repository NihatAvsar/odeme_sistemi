import type { BillItem, SelectedItem } from '../types/billing';

export type PaymentAllocationPreview = {
  orderItemId: string;
  quantity: number;
  amount: number;
};

export function buildPaymentAllocationPreview(items: BillItem[], selected: SelectedItem[]) {
  const selectedMap = new Map(selected.map((item) => [item.id, item.quantity]));

  return items
    .map((item) => {
      const quantity = selectedMap.get(item.id) ?? 0;
      if (!quantity) return null;

      return {
        orderItemId: item.id,
        quantity,
        amount: Number((quantity * item.unitPrice).toFixed(2)),
      } satisfies PaymentAllocationPreview;
    })
    .filter((entry): entry is PaymentAllocationPreview => entry !== null);
}
