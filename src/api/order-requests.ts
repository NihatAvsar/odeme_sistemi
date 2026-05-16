import { fetchJSON } from './client';
import { getAdminSecret } from './admin-auth';

export type RequestedItemDto = {
  menuItemId: string;
  quantity: number;
  optionIds?: string[];
};

export type OrderRequestDto = {
  id: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedBy?: string | null;
  note?: string | null;
  items: RequestedItemDto[];
  tableSession?: { table?: { id: string; code: string } };
  createdAt: string;
};

export async function createOrderRequest(input: {
  tableId: string;
  requestedBy?: string;
  note?: string;
  couponCode?: string;
  items: RequestedItemDto[];
}) {
  return fetchJSON<OrderRequestDto>('/api/order-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getPendingOrderRequests() {
  return fetchJSON<OrderRequestDto[]>('/api/order-requests?status=PENDING_APPROVAL', {
    headers: { 'x-admin-secret': getAdminSecret() },
  });
}

export async function approveOrderRequest(id: string, adminName = 'Admin') {
  return fetchJSON(`/api/order-requests/${id}/approve`, {
    method: 'POST',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify({ adminName }),
  });
}

export async function rejectOrderRequest(id: string, adminName = 'Admin', reason = 'Rejected') {
  return fetchJSON(`/api/order-requests/${id}/reject`, {
    method: 'POST',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify({ adminName, reason }),
  });
}
