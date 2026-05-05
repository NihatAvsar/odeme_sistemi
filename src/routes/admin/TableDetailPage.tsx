// src/routes/admin/TableDetailPage.tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAdminTable, type AdminTableDto } from '../../api/admin';

export function TableDetailPage() {
  const { tableId = '' } = useParams();
  const [table, setTable] = useState<AdminTableDto | null>(null);

  useEffect(() => {
    if (!tableId) return;
    void getAdminTable(tableId).then(setTable);
  }, [tableId]);

  if (!table) {
    return <main className="mx-auto max-w-6xl p-4 md:p-8">Yükleniyor...</main>;
  }

  const activeOrder = table.sessions[0]?.orders[0];

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Masa {table.code}</h1>
          <p className="text-sm text-slate-500">{table.name ?? 'İsimsiz'}</p>
        </div>
        <Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-sm font-medium">Dashboard</Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Aktif Adisyon</h2>
          {activeOrder ? (
            <div className="mt-4 space-y-2 text-sm">
              <p>Status: {activeOrder.status}</p>
              <p>Subtotal: {String(activeOrder.subtotal)}</p>
              <p>Kalan: {String(activeOrder.remaining)}</p>
              {activeOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between rounded-xl bg-slate-50 p-3">
                  <span>{item.nameSnapshot}</span>
                  <span>{item.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Aktif adisyon yok</p>
          )}
        </div>

        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Sipariş İstekleri</h2>
          <div className="mt-4 space-y-2 text-sm">
            {table.sessions[0]?.requests?.map((request) => (
              <div key={request.id} className="rounded-xl bg-slate-50 p-3">
                <p>{request.status}</p>
                <p className="text-slate-500">{request.requestedBy ?? 'Anonim'}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
