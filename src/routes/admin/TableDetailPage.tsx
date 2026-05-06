// src/routes/admin/TableDetailPage.tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cashSettleAdminTable, getAdminTable, type AdminTableDto } from '../../api/admin';
import { requireAdminSecret } from '../../api/admin-auth';
import { adminButtonClass, adminPageClass, adminSecondaryButtonClass, adminSectionClass, adminStatCardClass, getAdminSummaryToneClasses } from './admin-theme';
import { getTableStatusLabel, getTableStatusStyles } from './table-status';

export function TableDetailPage() {
  const { tableId = '' } = useParams();
  const [table, setTable] = useState<AdminTableDto | null>(null);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (!tableId) return;
    requireAdminSecret();
    void getAdminTable(tableId).then(setTable);
  }, [tableId]);

  if (!table) {
    return <main className="mx-auto max-w-6xl p-4 md:p-8">Yükleniyor...</main>;
  }

  const activeOrder = table.sessions[0]?.orders[0];
  const statusStyles = getTableStatusStyles(table.status);
  const totalRequests = table.sessions[0]?.requests?.length ?? 0;
  const itemCount = activeOrder?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const isCleaning = table.status === 'CLEANING';
  const releaseAtText = table.releaseAt ? new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(table.releaseAt)) : '';

  return (
    <main className={adminPageClass}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-700">Admin / Masa Detayı</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Masa {table.code}</h1>
          <p className="mt-1 text-sm text-slate-600">{table.name ?? 'İsimsiz'}</p>
          <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusStyles.badge}`}>
            {getTableStatusLabel(table.status)}
          </span>
          {isCleaning && table.releaseAt ? (
            <p className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/80 px-3 py-2 text-sm text-violet-800">
              Ödeme alındı, masa 3 dakika içinde boşalacak{releaseAtText ? ` (${releaseAtText})` : ''}.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {activeOrder && !isCleaning ? (
            <button
              type="button"
              disabled={settling}
              onClick={async () => {
                setSettling(true);
                try {
                  await cashSettleAdminTable(table.id);
                  await getAdminTable(table.id).then(setTable);
                } finally {
                  setSettling(false);
                }
              }}
              className={adminButtonClass}
            >
              {settling ? 'İşleniyor...' : 'Kasada Ödendi'}
            </button>
          ) : null}
          <Link to="/admin/dashboard" className={adminSecondaryButtonClass}>Dashboard</Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Masa Durumu" value={getTableStatusLabel(table.status)} tone="brand" />
        <StatCard label="Sipariş İsteği" value={String(totalRequests)} tone="amber" />
        <StatCard label="Ürün Adedi" value={String(itemCount)} tone="sky" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={adminSectionClass}>
          <h2 className="text-lg font-semibold">Aktif Adisyon</h2>
          {activeOrder ? (
            <div className="mt-4 space-y-2 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoTile label="Durum" value={activeOrder.status} />
                <InfoTile label="Subtotal" value={String(activeOrder.subtotal)} />
                <InfoTile label="Kalan" value={String(activeOrder.remaining)} />
              </div>
              {activeOrder.items.map((item) => (
                <div key={item.id} className="flex justify-between rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
                  <span className="font-medium">{item.nameSnapshot}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles.badge}`}>{item.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Aktif adisyon yok</p>
          )}
        </div>

        <div className={adminSectionClass}>
          <h2 className="text-lg font-semibold">Sipariş İstekleri</h2>
          <div className="mt-4 space-y-2 text-sm">
            {table.sessions[0]?.requests?.map((request) => (
              <div key={request.id} className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
                <p className="font-medium">{request.status}</p>
                <p className="text-slate-500">{request.requestedBy ?? 'Anonim'}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'brand' | 'sky' | 'amber' }) {
  const toneClasses = getAdminSummaryToneClasses(tone);

  return (
    <div className={`${adminStatCardClass} ${toneClasses.card}`}>
      <div className={`h-1 w-14 rounded-full ${toneClasses.accent}`} />
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className={`mt-3 text-xl font-semibold tracking-tight ${toneClasses.value}`}>{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
