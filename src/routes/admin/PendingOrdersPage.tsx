// src/routes/admin/PendingOrdersPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { approveOrderRequest, getPendingOrderRequests, rejectOrderRequest, type OrderRequestDto } from '../../api/order-requests';

export function PendingOrdersPage() {
  const [requests, setRequests] = useState<OrderRequestDto[]>([]);

  const refresh = async () => setRequests(await getPendingOrderRequests());

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bekleyen Siparişler</h1>
        <Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-sm font-medium">Dashboard</Link>
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
