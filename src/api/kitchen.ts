import { fetchJSON } from './client';
import { getAdminSecret } from './admin-auth';

export type KitchenStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export type KitchenTicketDto = {
  id: string;
  nameSnapshot: string;
  quantity: number;
  notes?: string | null;
  selectedOptions?: unknown;
  kitchenStatus: KitchenStatus;
  createdAt: string;
  order: {
    id: string;
    session: { table: { id: string; code: string; name?: string | null } };
  };
};

export async function getKitchenTickets() {
  return fetchJSON<KitchenTicketDto[]>('/api/admin/kitchen/tickets', {
    headers: { 'x-admin-secret': getAdminSecret() },
  });
}

export async function updateKitchenTicket(id: string, status: KitchenStatus) {
  return fetchJSON<KitchenTicketDto>(`/api/admin/kitchen/tickets/${id}`, {
    method: 'PATCH',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify({ status }),
  });
}
