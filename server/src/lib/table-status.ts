type AdminTableLike = {
  status: string;
  sessions?: Array<{
    orders?: Array<{ status?: string; remaining?: unknown }>;
    requests?: Array<{ status?: string }>;
  }>;
};

export function getEffectiveTableStatus(table: AdminTableLike) {
  if (table.status === 'CLEANING' || table.status === 'RESERVED' || table.status === 'DISABLED') {
    return table.status;
  }

  const hasActiveOrder = table.sessions?.some((session) =>
    session.orders?.some((order) => {
      if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_PAID') return false;
      return order.remaining === undefined || order.remaining === null || Number(order.remaining) > 0;
    }),
  ) ?? false;

  if (hasActiveOrder) return 'OCCUPIED';

  const hasPendingRequest = table.sessions?.some((session) =>
    session.requests?.some((request) => request.status === 'PENDING_APPROVAL'),
  ) ?? false;

  if (hasPendingRequest) return 'PENDING_APPROVAL';

  return 'AVAILABLE';
}
