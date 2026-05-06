import { fetchJSON } from './client';

export type ApiOrderItem = {
  id: string;
  groupKey?: string;
  menuItemId?: string | null;
  nameSnapshot: string;
  unitPriceSnapshot: string | number;
  quantity: number;
  paidQuantity: number;
  status: 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  notes?: string | null;
  lineTotal?: string | number;
};

export type ApiOrder = {
  id: string;
  subtotal: string | number;
  serviceFee: string | number;
  total: string | number;
  remaining: string | number;
  items: ApiOrderItem[];
};

export async function getOrder(orderId: string) {
  return fetchJSON<ApiOrder>(`/api/orders/${orderId}`);
}
