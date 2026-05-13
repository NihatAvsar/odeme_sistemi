import { fetchJSON } from './client';

export type TableActionType = 'CALL_WAITER' | 'REQUEST_BILL' | 'SEND_NOTE';
export type TableActionStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED';

export type TableActionDto = {
  id: string;
  restaurantId: string;
  tableId: string;
  sessionId?: string | null;
  type: TableActionType;
  status: TableActionStatus;
  message?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  table?: {
    id: string;
    code: string;
    name?: string | null;
  };
};

export async function createTableAction(tableCode: string, input: { type: TableActionType; message?: string }) {
  return fetchJSON<TableActionDto>(`/api/tables/${tableCode}/actions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
