import { fetchJSON } from './client';
import { getAdminSecret } from './admin-auth';

export type AdminTableDto = {
  id: string;
  restaurantId: string;
  code: string;
  name?: string | null;
  status: string;
  releaseAt?: string | null;
  sessions: Array<{
    id: string;
    orders: Array<{
      id: string;
      status: string;
      subtotal: string | number;
      remaining: string | number;
      items: Array<{
        id: string;
        nameSnapshot: string;
        quantity: number;
        paidQuantity: number;
        status: string;
      }>;
    }>;
    requests?: Array<{
      id: string;
      status: string;
      requestedBy?: string | null;
      note?: string | null;
      createdAt: string;
    }>;
  }>;
};

export async function getAdminTables() {
  return fetchJSON<AdminTableDto[]>('/api/admin/tables', {
    headers: { 'x-admin-secret': getAdminSecret() },
  });
}

export async function createAdminTables(input: { restaurantId?: string; count: number; namePrefix?: string; capacity?: number; startCode?: number }) {
  return fetchJSON<{ tables: Array<{ id: string; code: string; name: string | null; qrToken: string }> }>('/api/admin/tables', {
    method: 'POST',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify(input),
  });
}

export async function getAdminTable(tableId: string) {
  return fetchJSON<AdminTableDto>(`/api/admin/tables/${tableId}`, {
    headers: { 'x-admin-secret': getAdminSecret() },
  });
}

export async function cashSettleAdminTable(tableId: string) {
  return fetchJSON<unknown>(`/api/admin/tables/${tableId}/cash-settle`, {
    method: 'POST',
    headers: { 'x-admin-secret': getAdminSecret() },
  });
}

export async function updateAdminTableStatus(tableId: string, status: 'AVAILABLE' | 'RESERVED') {
  return fetchJSON<AdminTableDto>(`/api/admin/tables/${tableId}/status`, {
    method: 'PATCH',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify({ status }),
  });
}
