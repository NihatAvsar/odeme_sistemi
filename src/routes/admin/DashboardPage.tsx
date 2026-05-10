// src/routes/admin/DashboardPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminTables, type AdminTableDto } from '../../api/admin';
import { getPendingOrderRequests, type OrderRequestDto } from '../../api/order-requests';
import { requireAdminSecret } from '../../api/admin-auth';

export function DashboardPage() {
  const [tables, setTables] = useState<AdminTableDto[]>([]);
  const [pending, setPending] = useState<OrderRequestDto[]>([]);

  useEffect(() => {
    requireAdminSecret();
    void getAdminTables().then(setTables);
    void getPendingOrderRequests().then(setPending);
  }, []);

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-slate-500">Masalar ve bekleyen siparişler</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/menu" className="rounded-xl border px-3 py-2 text-sm font-medium">Menü</Link>
          <Link to="/admin/tables" className="rounded-xl border px-3 py-2 text-sm font-medium">Masalar</Link>
          <Link to="/admin/kitchen" className="rounded-xl border px-3 py-2 text-sm font-medium">Mutfak</Link>
          <Link to="/admin/settings" className="rounded-xl border px-3 py-2 text-sm font-medium">Ayarlar</Link>
          <Link to="/admin/pending-orders" className="rounded-xl border px-3 py-2 text-sm font-medium">Bekleyen Siparişler</Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Toplam Masa" value={String(tables.length)} />
        <Stat label="Bekleyen Sipariş" value={String(pending.length)} />
        <Stat label="Aktif Masa" value={String(tables.filter((table) => table.sessions.length > 0).length)} />
      </section>

      <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">Masa Özeti</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => (
            <Link key={table.id} to={`/admin/tables/${table.id}`} className="rounded-2xl border p-4 hover:bg-slate-50">
              <p className="font-medium">Masa {table.code}</p>
              <p className="text-sm text-slate-500">{table.name ?? 'İsimsiz'}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">{table.status}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
