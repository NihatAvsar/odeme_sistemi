import { fetchJSON } from './client';

export type AdminTableDto = {
  id: string;
  code: string;
  name?: string | null;
  status: string;
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
  return fetchJSON<AdminTableDto[]>('/api/admin/tables');
}

export async function getAdminTable(tableId: string) {
  return fetchJSON<AdminTableDto>(`/api/admin/tables/${tableId}`);
}
