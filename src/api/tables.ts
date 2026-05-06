import { fetchJSON } from './client';
import type { ApiOrder } from './orders';

export type TableContextDto = {
  table: { id: string; code: string; name?: string | null; restaurantId: string };
  session: { id: string; status: string } | null;
  activeOrder: ApiOrder | null;
};

export async function getTableContext(tableCode: string) {
  return fetchJSON<TableContextDto>(`/api/tables/${tableCode}`);
}
