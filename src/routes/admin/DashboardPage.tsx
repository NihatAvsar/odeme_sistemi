// src/routes/admin/DashboardPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminTables, type AdminTableDto } from '../../api/admin';
import { getPendingOrderRequests, type OrderRequestDto } from '../../api/order-requests';
import { requireAdminSecret } from '../../api/admin-auth';
import { getAdminTableActions } from '../../api/admin-table-actions';
import type { TableActionDto } from '../../api/table-actions';

export function DashboardPage() {
  const [tables, setTables] = useState<AdminTableDto[]>([]);
  const [pending, setPending] = useState<OrderRequestDto[]>([]);
  const [actions, setActions] = useState<TableActionDto[]>([]);

  useEffect(() => {
    requireAdminSecret();
    void getAdminTables().then(setTables);
    void getPendingOrderRequests().then(setPending);
    void getAdminTableActions('OPEN').then(setActions);
  }, []);

  const waiterCalls = actions.filter((action) => action.type === 'CALL_WAITER').length;
  const billRequests = actions.filter((action) => action.type === 'REQUEST_BILL').length;
  const recentNotes = actions.filter((action) => action.type === 'SEND_NOTE').slice(0, 3);

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
          <Link to="/admin/reports" className="rounded-xl border px-3 py-2 text-sm font-medium">Raporlar</Link>
          <Link to="/admin/table-actions" className="rounded-xl border px-3 py-2 text-sm font-medium">Masa İstekleri</Link>
          <Link to="/admin/settings" className="rounded-xl border px-3 py-2 text-sm font-medium">Ayarlar</Link>
          <Link to="/admin/pending-orders" className="rounded-xl border px-3 py-2 text-sm font-medium">Bekleyen Siparişler</Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Toplam Masa" value={String(tables.length)} />
        <Stat label="Bekleyen Sipariş" value={String(pending.length)} />
        <Stat label="Aktif Masa" value={String(tables.filter((table) => table.status === 'OCCUPIED' || table.status === 'PENDING_APPROVAL').length)} />
      </section>

      <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Operasyon Paneli</h2>
            <p className="text-sm text-slate-500">Açık masa istekleri ve son notlar</p>
          </div>
          <Link to="/admin/table-actions" className="rounded-xl border px-3 py-2 text-sm font-medium">Tümünü Aç</Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Stat label="Garson Çağrısı" value={String(waiterCalls)} />
          <Stat label="Hesap İsteği" value={String(billRequests)} />
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Son Notlar</p>
            <div className="mt-3 space-y-2">
              {recentNotes.length === 0 ? <p className="text-sm text-slate-400">Açık not yok</p> : null}
              {recentNotes.map((action) => (
                <p key={action.id} className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-700">
                  Masa {action.table?.code ?? action.tableId}: {action.message}
                </p>
              ))}
            </div>
          </div>
        </div>
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
