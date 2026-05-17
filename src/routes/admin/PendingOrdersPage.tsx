// src/routes/admin/PendingOrdersPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { approveOrderRequest, getPendingOrderRequests, rejectOrderRequest, type OrderRequestDto } from '../../api/order-requests';
import { getAdminSocket } from '../../lib/socket';
import { getAdminTables } from '../../api/admin';

export function PendingOrdersPage() {
  const [requests, setRequests] = useState<OrderRequestDto[]>([]);

  const refresh = async () => {
    const data = await getPendingOrderRequests();
    setRequests(data);
    return data;
  };

  useEffect(() => {
    const socket = getAdminSocket();
    socket.connect();

    const onNewRequest = () => { void refresh(); };
    socket.on('order-request.created', onNewRequest);
    socket.on('order-request.updated', onNewRequest);

    // Sayfa yüklenince restaurantId al ıp socket odasına katıl
    void Promise.all([refresh(), getAdminTables()]).then(([_requests, tables]) => {
      if (tables.length > 0) {
        const rid = tables[0].restaurantId;
        if (rid) socket.emit('admin:join', rid);
      }
    });

    return () => {
      socket.off('order-request.created', onNewRequest);
      socket.off('order-request.updated', onNewRequest);
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bekleyen Siparişler</h1>
        <div className="flex gap-2">
          <Link to="/admin/menu" className="rounded-xl border px-3 py-2 text-sm font-medium">Menü</Link>
          <Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-sm font-medium">Dashboard</Link>
        </div>
      </div>

      <div className="space-y-3">
        {requests.map((request) => (
          <article key={request.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{request.requestedBy ?? 'Anonim'}</p>
                <p className="text-sm text-slate-500">{request.status}</p>
              </div>
              <p className="text-sm text-slate-500">{new Date(request.createdAt).toLocaleString('tr-TR')}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await approveOrderRequest(request.id);
                  await refresh();
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
              >
                Onayla
              </button>
              <button
                type="button"
                onClick={async () => {
                  await rejectOrderRequest(request.id);
                  await refresh();
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white"
              >
                Reddet
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
