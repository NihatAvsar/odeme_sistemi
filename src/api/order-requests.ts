import { fetchJSON } from './client';

export type RequestedItemDto = {
  menuItemId: string;
  quantity: number;
};

export type OrderRequestDto = {
  id: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedBy?: string | null;
  note?: string | null;
  items: RequestedItemDto[];
  createdAt: string;
};

export async function createOrderRequest(input: {
  tableId: string;
  requestedBy?: string;
  note?: string;
  items: RequestedItemDto[];
}) {
  return fetchJSON<OrderRequestDto>('/api/order-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getPendingOrderRequests() {
  return fetchJSON<OrderRequestDto[]>('/api/order-requests?status=PENDING_APPROVAL');
}

export async function approveOrderRequest(id: string, adminName = 'Admin') {
  return fetchJSON(`/api/order-requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminName }),
  });
}

export async function rejectOrderRequest(id: string, adminName = 'Admin', reason = 'Rejected') {
  return fetchJSON(`/api/order-requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ adminName, reason }),
  });
}
