import { fetchJSON } from './client';

export type ApiOrderItem = {
  id: string;
  nameSnapshot: string;
  unitPriceSnapshot: string | number;
  quantity: number;
  paidQuantity: number;
  status: 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
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
