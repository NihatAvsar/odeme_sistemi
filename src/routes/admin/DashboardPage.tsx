// src/routes/admin/DashboardPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminTables, type AdminTableDto } from '../../api/admin';
import { getPendingOrderRequests, type OrderRequestDto } from '../../api/order-requests';
import { requireAdminSecret } from '../../api/admin-auth';
import { getAdminTableActions } from '../../api/admin-table-actions';
import type { TableActionDto } from '../../api/table-actions';
import { adminCardClass } from './admin-theme';
import { getTableStatusLabel, getTableStatusStyles } from './table-status';

export function DashboardPage() {
  const [tables, setTables] = useState<AdminTableDto[]>([]);
  const [pending, setPending] = useState<OrderRequestDto[]>([]);
  const [actions, setActions] = useState<TableActionDto[]>([]);

  useEffect(() => {
    requireAdminSecret();
    void getAdminTables().then(setTables);
    void getPendingOrderRequests().then(setPending);
    void getAdminTableActions('ALL').then((items) => setActions(items.filter((action) => action.status === 'OPEN' || action.status === 'ACKNOWLEDGED')));
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
          <AdminNavLink to="/admin/menu" label="Menü" />
          <AdminNavLink to="/admin/tables" label="Masalar" />
          <AdminNavLink to="/admin/kitchen" label="Mutfak" />
          <AdminNavLink to="/admin/reports" label="Raporlar" />
          <AdminNavLink to="/admin/table-actions" label="Masa İstekleri" count={actions.length} />
          <Link to="/admin/settings" className="rounded-xl border px-3 py-2 text-sm font-medium">Ayarlar</Link>
          <AdminNavLink to="/admin/pending-orders" label="Bekleyen Siparişler" count={pending.length} />
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
          {[...tables].sort((a, b) => Number(a.code) - Number(b.code)).map((table) => {
            const styles = getTableStatusStyles(table.status);
            const tableActions = actions.filter((action) => action.tableId === table.id);
            const requests = table.sessions[0]?.requests ?? [];
            const requestItemCount = requests.reduce((sum, request) => sum + (request.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) ?? 0), 0);

            return (
              <Link key={table.id} to={`/admin/tables/${table.id}`} className={`${adminCardClass} ${styles.card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] opacity-70">Masa</p>
                    <p className="mt-1 text-2xl font-semibold">{table.code}</p>
                    <p className="mt-1 text-sm opacity-75">{table.name ?? 'İsimsiz'}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles.badge}`}>
                    {getTableStatusLabel(table.status)}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  {tableActions.length > 0 ? <p className="font-medium">İstek: {tableActions.map((action) => actionLabel(action.type)).join(', ')}</p> : null}
                  {requestItemCount > 0 ? <p className="font-medium">Bekleyen sipariş: {requestItemCount} ürün</p> : null}
                  {requests[0]?.note ? <p className="rounded-2xl bg-white/60 px-3 py-2 text-xs">Not: {requests[0].note}</p> : null}
                  {tableActions.length === 0 && requestItemCount === 0 ? <p className="text-sm opacity-70">Aktif istek yok</p> : null}
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function AdminNavLink({ to, label, count = 0 }: { to: string; label: string; count?: number }) {
  return (
    <Link to={to} className="relative rounded-xl border px-3 py-2 text-sm font-medium">
      {label}
      {count > 0 ? (
        <span className="absolute -right-2 -top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-xs font-semibold leading-none text-white ring-2 ring-white">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

function actionLabel(type: string) {
  switch (type) {
    case 'CALL_WAITER': return 'Garson çağırma';
    case 'REQUEST_BILL': return 'Hesap isteme';
    case 'SEND_NOTE': return 'Not';
    default: return type;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
