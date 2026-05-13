import { fetchJSON } from './client';
import { getAdminSecret } from './admin-auth';
import type { TableActionDto, TableActionStatus } from './table-actions';

export async function getAdminTableActions(status: TableActionStatus | 'ALL' = 'OPEN') {
  const query = status === 'ALL' ? '' : `?status=${status}`;
  return fetchJSON<TableActionDto[]>(`/api/admin/table-actions${query}`, {
    headers: { 'x-admin-secret': getAdminSecret() },
  });
}

export async function updateAdminTableAction(actionId: string, status: TableActionStatus) {
  return fetchJSON<TableActionDto>(`/api/admin/table-actions/${actionId}`, {
    method: 'PATCH',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify({ status, resolvedBy: getAdminSecret() }),
  });
}
